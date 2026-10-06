# 02 — Clientes (captación de información)

## Contexto

`clientes` ya existe en el esquema (`0001_initial_schema.sql`) con `nombre, rif_ci, telefono, notas, activo`, y `IClienteRepository` ya está definido en `lib/repositories/interfaces.ts`. Hoy se gestiona dentro de la pantalla genérica `/catalogos` (placeholder), junto con productos y proveedores.

El usuario pidió que Clientes sea su propio módulo, enfocado en **captación de información** — es decir, no solo un CRUD mínimo, sino el formulario que de verdad se usa para registrar un cliente nuevo con los datos que el negocio necesita para fiar (crédito) y contactar.

## Decisión de diseño

Clientes se separa de Proveedores/Productos en la navegación y en el código (aunque comparten la página `/catalogos` hoy, este módulo le da ruta propia `/clientes`). `/catalogos` queda para Productos + Proveedores + configuración (IVA, fuentes de tasa) — fuera del alcance de este módulo.

## Alcance

### Datos a capturar (extiende el esquema actual)

| Campo | Tipo | Nota |
|---|---|---|
| `nombre` | text, requerido | ya existe |
| `rif_ci` | text | ya existe; agregar validación de formato (V-/E-/J- + números) en UI |
| `telefono` | text | ya existe |
| `email` | text | **nuevo** |
| `direccion` | text | **nuevo** |
| `notas` | text | ya existe |
| `limite_credito_usd` | numeric(14,6), nullable | **nuevo** — tope de deuda permitida antes de bloquear nuevos pedidos a crédito |
| `activo` | boolean | ya existe |
| `created_at` | timestamptz | ya existe |

No se agrega adjunto de documentos (foto de cédula/RIF) en este MVP — se deja anotado como fuera de alcance.

### Pantalla `/clientes`

- Listado (MUI DataGrid): nombre, rif_ci, teléfono, saldo pendiente (calculado, ver abajo), activo.
- Alta/edición en formulario (modal o página `/clientes/[id]`), con validación de campos requeridos y formato de `rif_ci`/`email`.
- Baja lógica (`activo = false`), nunca delete físico si el cliente tiene facturas o pedidos asociados (ver regla abajo).
- Ficha de cliente: datos + historial de facturas/pedidos (de solo lectura; el detalle de facturación pertenece a 04-ventas, aquí solo se consume).

### Regla de integridad

- No permitir `delete` de un cliente con `facturas` o `pedidos` asociados (ni físico ni vía UI); solo desactivar. El repositorio debe lanzar un error claro si Supabase rechaza el delete por FK, o mejor, verificar antes de intentarlo.

### Saldo pendiente (solo lectura en esta pantalla)

- Se calcula como `Σ(facturas.total_usd − facturas.pagado_usd)` para facturas en estado `abierta` de ese cliente. La lógica de cálculo vive en `04-ventas` (o en un `ClienteBalanceService` compartido) — este módulo solo la consume para mostrarla, no la implementa desde cero. Si `04-ventas` todavía no existe al construir este módulo, mostrar `—` y dejar el campo listo para conectar después.

## Fuera de alcance (MVP)
- Adjuntar documentos/fotos de identificación.
- Historial de cambios (auditoría) sobre la ficha de cliente.
- Segmentación/categorías de cliente (VIP, mayorista, etc.).
