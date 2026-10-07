# 03 — Proveedores (control e información)

## Contexto

`proveedores` ya existe en el esquema (`0001_initial_schema.sql`) con `nombre, rif_ci, telefono, notas, activo`, y `IProveedorRepository` ya está definido en `lib/repositories/interfaces.ts`. Hoy se gestiona dentro de la pantalla genérica `/catalogos` (placeholder), junto con productos.

El usuario pidió un módulo propio de Proveedores, separado de Catálogo, para tener control e información real de con quién compra el negocio: a quién se le paga, cuánto se le debe, con quién se puede negociar crédito, y qué proveedores no son confiables (entregas incompletas, producto en mal estado, desaparecen con un pago adelantado). Es el mismo principio que `02-clientes`, aplicado a la otra punta del negocio.

## Decisión de diseño

Proveedores se separa de Productos en la navegación y en el código: ruta propia `/proveedores`, análoga a `/clientes`. `/catalogos` (en `04-inventario`) queda solo para productos + configuración.

## Alcance

### Datos a capturar (extiende el esquema actual)

| Campo | Tipo | Nota |
|---|---|---|
| `nombre` | text, requerido | ya existe — razón social si es persona jurídica |
| `tipo_persona` | text check (`natural`,`juridica`) | **nuevo**, default `juridica` (la mayoría de proveedores de pescado son cooperativas/empresas, pero puede haber pescadores independientes) |
| `rif_ci` | text | ya existe; agregar validación de formato (V-/E-/J- + números) en UI |
| `telefono` | text | ya existe |
| `email` | text | **nuevo** |
| `direccion` | text | **nuevo** |
| `contacto_nombre` | text, nullable | **nuevo** — persona de contacto habitual para hacer pedidos (puede diferir del representante legal) |
| `contacto_telefono` | text, nullable | **nuevo** |
| `banco` | text, nullable | **nuevo** |
| `numero_cuenta` | text, nullable | **nuevo** |
| `titular_cuenta` | text, nullable | **nuevo** — para pagos por transferencia; puede no coincidir con `nombre` si la cuenta es personal del representante |
| `notas` | text | ya existe |
| `bloqueado` | boolean, default false | **nuevo** — ver "Control de confiabilidad" |
| `motivo_bloqueo` | text, nullable | **nuevo** |
| `activo` | boolean | ya existe |
| `created_at` | timestamptz | ya existe |

### Control de confiabilidad

- Un `admin` puede marcar `bloqueado = true` con `motivo_bloqueo` obligatorio (ej. "entregó producto en mal estado dos veces", "no entregó tras cobrar adelanto"). Un proveedor bloqueado no puede recibir nuevas compras **a crédito** desde `04-inventario` (sí se le puede seguir comprando de contado, salvo que se decida lo contrario al implementar) — la validación real ocurre en `04-inventario` al crear la compra, no solo en la UI de este módulo.
- Documento adjunto de RIF (verificación básica de que el proveedor es una entidad real antes de otorgarle crédito): tabla `public.documentos_proveedor (id uuid pk, proveedor_id uuid references proveedores, tipo text check (rif, cedula, otro), url_storage text, created_at timestamptz)`, subido a bucket privado `documentos-proveedores` (mismo patrón que `documentos-clientes` de `02-clientes` y `contratos` de `06-contratos`: solo se guarda la ruta, se genera signed URL al vuelo para ver/descargar).

### Pantalla `/proveedores`

- Listado (MUI DataGrid): nombre, rif_ci, teléfono, saldo pendiente (calculado, ver abajo), bloqueado (badge si aplica), activo.
- Alta/edición en formulario (modal o página `/proveedores/[id]`), con validación de formato de `rif_ci`/`email`.
- Carga de documento (RIF) desde el mismo formulario, con vista previa y opción de reemplazar.
- Baja lógica (`activo = false`), nunca delete físico si el proveedor tiene compras asociadas (ver regla abajo).
- Acción "bloquear/desbloquear" (solo `admin`, depende de `01-auth` Fase 2) con campo de motivo obligatorio al bloquear.
- Ficha de proveedor: datos + historial de compras (de solo lectura; el detalle de compras pertenece a `04-inventario`, aquí solo se consume).

### Regla de integridad

- No permitir `delete` de un proveedor con `compras` asociadas (ni físico ni vía UI); solo desactivar. El repositorio debe lanzar un error claro si Supabase rechaza el delete por FK, o mejor, verificar antes de intentarlo (mismo patrón que `clienteRepository` en `02-clientes`).

### Saldo pendiente (solo lectura en esta pantalla)

- Se calcula como `Σ(compras.subtotal_usd − compras.pagado_usd)` para compras en estado `abierta` de ese proveedor. La lógica de cálculo vive en `04-inventario` (`ProveedorBalanceService`) — este módulo solo la consume para mostrarla, no la implementa desde cero. Si `04-inventario` todavía no existe al construir este módulo, mostrar `—` y dejar el campo listo para conectar después.

## Fuera de alcance (MVP)
- Verificación automática de RIF contra una fuente oficial (SENIAT) — la captura es manual.
- Historial de cambios (auditoría) sobre la ficha de proveedor.
- Calificación/scoring numérico de proveedores (más allá del flag `bloqueado` + notas).
- Múltiples cuentas bancarias por proveedor (solo una cuenta en el MVP).
