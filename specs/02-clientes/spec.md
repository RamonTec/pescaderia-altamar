# 02 — Clientes (captación de información)

## Contexto

`clientes` ya existe en el esquema (`0001_initial_schema.sql`) con `nombre, rif_ci, telefono, notas, activo`, y `IClienteRepository` ya está definido en `lib/repositories/interfaces.ts`. Hoy se gestiona dentro de la pantalla genérica `/catalogos` (placeholder), junto con productos y proveedores.

El usuario pidió que Clientes sea su propio módulo, enfocado en **captación de información** — es decir, no solo un CRUD mínimo, sino el formulario que de verdad se usa para registrar un cliente nuevo con los datos que el negocio necesita para fiar (crédito) y contactar.

**Actualización de alcance**: el negocio fía a clientes que pueden ser persona natural o persona jurídica (empresa), y necesita capturar quién responde legalmente por la deuda — no solo nombre y teléfono — para protegerse ante estafas (clientes que desaparecen, representantes que niegan haber autorizado una compra, etc.). Esto amplía la captación de datos; ver sección "Antifraude / KYC" abajo.

## Decisión de diseño

Clientes se separa de Proveedores/Productos en la navegación y en el código (aunque comparten la página `/catalogos` hoy, este módulo le da ruta propia `/clientes`). `/catalogos` queda para Productos + Proveedores + configuración (IVA, fuentes de tasa) — fuera del alcance de este módulo.

## Alcance

### Datos a capturar (extiende el esquema actual)

| Campo | Tipo | Nota |
|---|---|---|
| `nombre` | text, requerido | ya existe — para persona jurídica, es la razón social |
| `tipo_persona` | text check (`natural`,`juridica`) | **nuevo**, default `natural` |
| `rif_ci` | text | ya existe; agregar validación de formato (V-/E-/J- + números) en UI; en persona jurídica es el RIF de la empresa |
| `telefono` | text | ya existe |
| `email` | text | **nuevo** |
| `direccion` | text | **nuevo** — dirección fiscal/de habitación, usada también en el contrato (`06-contratos`) |
| `notas` | text | ya existe |
| `limite_credito_usd` | numeric(14,6), nullable | **nuevo** — tope de deuda permitida antes de bloquear nuevos pedidos a crédito |
| `bloqueado` | boolean, default false | **nuevo** — ver "Antifraude / KYC" |
| `motivo_bloqueo` | text, nullable | **nuevo** |
| `activo` | boolean | ya existe |
| `created_at` | timestamptz | ya existe |

### Antifraude / KYC

Objetivo: si un cliente deja una deuda sin pagar o hay una disputa, el negocio debe poder identificar sin ambigüedad quién se comprometió.

- **Persona natural** (`tipo_persona = 'natural'`): el propio `rif_ci` (cédula) ya identifica a la persona — no se requiere tabla adicional.
- **Persona jurídica** (`tipo_persona = 'juridica'`): se exige al menos un representante legal. Nueva tabla `public.representantes_legales`:

  | Columna | Tipo | Nota |
  |---|---|---|
  | `id` | uuid pk | |
  | `cliente_id` | uuid, references clientes | |
  | `nombre` | text, requerido | |
  | `cedula` | text, requerido | formato V-/E- |
  | `cargo` | text, nullable | ej. "Gerente General" |
  | `telefono` | text, nullable | |
  | `created_at` | timestamptz | |

  Un cliente jurídico puede tener más de un representante (ej. dos socios); la UI exige al menos uno antes de guardar un cliente `juridica`.

- **Documentos adjuntos**: se captura foto/escaneo de cédula (persona natural o de cada representante) y RIF (si es jurídica), subidos a un bucket privado de Supabase Storage (`documentos-clientes`, mismo patrón que el bucket `contratos` de `06-contratos`). Nueva tabla `public.documentos_cliente (id uuid pk, cliente_id uuid references clientes, tipo text check (cedula, rif, otro), url_storage text, created_at timestamptz)`. Se guarda la ruta en storage, no el archivo en la fila; para ver/descargar se genera signed URL al vuelo (igual que en `06-contratos`).
- **Bloqueo**: un `admin` puede marcar `bloqueado = true` con `motivo_bloqueo` (ej. cheque devuelto, deuda impagada reportada). Un cliente bloqueado no puede recibir nuevas ventas a crédito (sí se le puede seguir vendiendo de contado, salvo que se decida lo contrario al implementar). Esta validación la aplica `05-ventas` al crear una factura/pedido, no solo la UI de este módulo.

### Pantalla `/clientes`

- Listado (MUI DataGrid): nombre, rif_ci, teléfono, saldo pendiente (calculado, ver abajo), bloqueado (badge visible si aplica), activo.
- Alta/edición en formulario (modal o página `/clientes/[id]`), con validación de campos requeridos y formato de `rif_ci`/`email`. El formulario cambia según `tipo_persona`: si es `juridica`, aparece la sub-sección de representantes legales (al menos uno) y el campo "RIF" se etiqueta distinto a "cédula".
- Carga de documentos (cédula/RIF) desde el mismo formulario, con vista previa y opción de reemplazar.
- Baja lógica (`activo = false`), nunca delete físico si el cliente tiene facturas o pedidos asociados (ver regla abajo).
- Acción "bloquear/desbloquear" (solo `admin`, depende de `01-auth` Fase 2) con campo de motivo obligatorio al bloquear.
- Ficha de cliente: datos + representantes (si aplica) + documentos + historial de facturas/pedidos (de solo lectura; el detalle de facturación pertenece a 05-ventas, aquí solo se consume).

### Regla de integridad

- No permitir `delete` de un cliente con `facturas` o `pedidos` asociados (ni físico ni vía UI); solo desactivar. El repositorio debe lanzar un error claro si Supabase rechaza el delete por FK, o mejor, verificar antes de intentarlo.

### Saldo pendiente (solo lectura en esta pantalla)

- Se calcula como `Σ(facturas.total_usd − facturas.pagado_usd)` para facturas en estado `abierta` de ese cliente. La lógica de cálculo vive en `05-ventas` (o en un `ClienteBalanceService` compartido) — este módulo solo la consume para mostrarla, no la implementa desde cero. Si `05-ventas` todavía no existe al construir este módulo, mostrar `—` y dejar el campo listo para conectar después.

## Fuera de alcance (MVP)
- Verificación automática de cédula/RIF contra una fuente oficial (SAIME/SENIAT) — la captura es manual, el negocio es responsable de validar visualmente contra el documento.
- Historial de cambios (auditoría) sobre la ficha de cliente.
- Segmentación/categorías de cliente (VIP, mayorista, etc.).
- Firma digital o huella en el registro de cliente (más allá del documento adjunto).
