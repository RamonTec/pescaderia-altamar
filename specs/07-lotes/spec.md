# 07 — Lotes y trazabilidad

## Contexto

Requerimiento del cliente (2026-10-07): el negocio **separa físicamente cada recepción en lotes**. Ejemplo: el lunes llegan 30 kg de salmón y el martes otros 30 kg. El sistema sabe que hay 60 kg, pero en la cava son dos lotes distintos (aunque sean del mismo proveedor). Al procesar, el operador **elige de qué lote** saca el salmón. Además quieren **trazabilidad por lote**: cuánto se compró, cuánto se perdió y cuánto se vendió de cada uno, por separado, para calcular el resultado con las tasas de cada operación.

Esto choca con una decisión cerrada de `/SPEC.md` §2 (costeo por **promedio ponderado** por producto) y con lo que ya está implementado en `04-inventario` y `05-ventas`. Ya se había descartado procesar por lote para no reabrir esa decisión (ver nota del 2026-10-06 en `04-inventario/tasks.md`). **El usuario la reabre explícitamente el 2026-10-07.**

Se plantea como módulo propio porque cruza dos módulos ya implementados (compras, procesamiento, ventas, notas de crédito). Así se ejecuta y verifica como una unidad, y en `04`/`05` solo se anota como "tarea agregada".

Depende de: `04-inventario` (compras y procesamiento implementados) y `05-ventas` (facturación y notas de crédito implementadas). **Absorbe** las tareas 16–19 de `04-inventario` (pantalla `/inventario`), que todavía no se habían hecho y ahora se construyen ya con lotes.

## Decisiones cerradas (2026-10-07, con el usuario)

| Tema | Decisión |
|---|---|
| Costeo | **Costo propio de cada lote** (identificación específica). Cada lote conserva su costo/kg en USD, su moneda y la tasa de su compra. Al procesar, vender o perder, se usa el costo del lote del que salió el producto. **Reemplaza el promedio ponderado** de `/SPEC.md` §2/§4.1. El "costo promedio" de un producto pasa a ser solo un dato informativo (`valor de sus lotes / kg en stock`). |
| Origen de un lote | Cada **línea de compra** (`compra_items`) crea un lote. Cada **línea de procesamiento** crea un lote del producto procesado. |
| Procesamiento | El operador **elige el lote crudo** de origen. **Un lote crudo da un lote procesado**: no se mezclan lotes. Procesar dos lotes = dos líneas = dos lotes de filete. |
| Venta (POS y entrega de pedido) | **Automático, el más antiguo primero (PEPS)**. Si un lote no alcanza, se completa con el siguiente. El vendedor puede cambiar la asignación si físicamente tomó otro. |
| Pérdidas | Fuera del procesamiento (dañado, vencido, faltante, otro), **cualquier usuario** puede registrarlas en un lote, con kg y motivo obligatorio. El admin las ve en la trazabilidad. |
| Productos sin control de stock | `productos.controla_stock = false` no usan lotes (ni asignación ni validación de stock). |

## Modelo de datos

### `lotes` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `codigo` | text unique not null | legible para rotular la cava: `<productos.codigo>-<AAMMDD>-<n>` (ej. `SALM-261005-1`). Lo genera la RPC bajo lock (`n` = consecutivo por producto y día). |
| `producto_id` | uuid FK `productos` | |
| `origen` | text check (`compra`,`proceso`,`inicial`) | `inicial` = lote de migración de stock existente |
| `compra_item_id` | uuid FK `compra_items`, unique, nullable | origen `compra` |
| `proceso_item_id` | uuid FK `proceso_items`, unique, nullable | origen `proceso` |
| `lote_padre_id` | uuid FK `lotes`, nullable | lote crudo del que salió un lote procesado |
| `proveedor_id` | uuid FK `proveedores`, nullable | de la compra; los procesados lo heredan del padre (para filtrar por proveedor sin joins recursivos) |
| `fecha_ingreso` | date | fecha de la compra o del procesamiento; ordena el PEPS |
| `peso_inicial_kg` | numeric(12,3) > 0 | |
| `costo_usd_kg` | numeric(14,6) ≥ 0 | **fijo**: compra = costo del item; proceso = `costo_total_origen / peso_salida` (la merma encarece el kg, §4.3) |
| `moneda`, `tasa_snapshot` | text, numeric(14,6) | de la compra; los procesados los heredan del padre. Permiten expresar el costo en Bs a la tasa con la que se compró. |
| `estado` | text check (`abierto`,`agotado`,`cerrado`) | `agotado` = stock 0 (automático); `cerrado` = cierre manual con el remanente dado de baja |
| `notas`, `created_at` | | |

Check: el origen determina qué FK está llena (`compra` ↔ `compra_item_id`, `proceso` ↔ `proceso_item_id` + `lote_padre_id`).

**Stock de un lote** = `Σ movimientos.peso_kg where lote_id = lote.id`. No se guarda una columna de stock que se pueda desincronizar del ledger. Para listar rápido: vista `lotes_stock` con un `group by`, e índice `movimientos (lote_id)`.

### Cambios a tablas existentes

| Tabla | Cambio |
|---|---|
| `movimientos` | `+ lote_id uuid FK lotes` (check `lote_id is not null` **`not valid`** para no romper el historial; productos con `controla_stock = false` quedan exentos); `tipo` suma `perdida`. El `costo_usd_kg` de toda salida = costo del lote. |
| `proceso_items` | `+ lote_origen_id uuid FK lotes` (obligatorio en filas nuevas, `not valid`) |
| `factura_items` | sin columnas nuevas; `costo_usd_kg` pasa a ser el **promedio de su asignación** (`Σ peso×costo / peso`), así los reportes de margen existentes siguen funcionando |
| `factura_item_lotes` (**nueva**) | `(id, factura_item_id FK cascade, lote_id FK, peso_kg > 0, costo_usd_kg)`: de qué lotes salió cada línea vendida. `Σ peso_kg` = `factura_items.peso_kg`. |
| `nota_credito_items` | la devolución con `afecta_inventario` vuelve **a sus lotes de origen** (orden inverso de la asignación) al costo de cada lote, y reabre el lote si estaba `agotado`. Anular la nota revierte esos mismos movimientos. |
| `perdidas_lote` (**nueva**) | `(id, lote_id, fecha, peso_kg > 0, motivo check (danado, vencido, faltante, cierre, otro), detalle, usuario_id default auth.uid(), created_at)` + movimiento `perdida` |
| `config_negocio` | `+ dias_alerta_lote int nullable`: a partir de cuántos días un lote abierto se marca como "antiguo" (pescado fresco) |

### Seguridad (mismo enfoque que `0003`)

- `lotes.costo_usd_kg` y `factura_item_lotes.costo_usd_kg` son costos: se revoca `select` de las tablas base y se expone `lotes_view` / `factura_item_lotes_view` con el costo en `null` si `not es_admin()`. El operador ve código, producto, proveedor, fechas, kg y estado.
- Todas las escrituras que tocan stock pasan por **RPC `security definer`** que leen el costo del lote sin devolverlo al invocador y **bloquean la fila del lote** (`select … for update`). Esto reemplaza el `pg_advisory_xact_lock` por producto de `0013`: dos operaciones sobre el mismo lote se serializan y nunca dejan stock negativo.

## Reglas de negocio

### Compra
- `registrar_compra` crea un lote por cada item (código generado) y el movimiento `compra` con `lote_id`. Devuelve los códigos (sin costos) para que la UI los muestre y se puedan **rotular los recipientes**.

### Procesamiento (`/SPEC.md` §4.3 por lote)
- Cada línea indica `lote_origen_id`. El producto destino debe ser un procesado cuyo `producto_origen_id` sea el producto del lote (regla de `0014`).
- `peso_entrada_kg ≤ stock del lote` (bajo lock). `costo_total = peso_entrada × lote.costo_usd_kg`; el lote destino nace con `costo_usd_kg = costo_total / peso_salida`, `lote_padre_id` = origen y hereda proveedor, moneda y tasa.
- Movimientos: `proceso_out` (−entrada, lote origen) y `proceso_in` (+salida, lote destino). Si el origen queda en 0, pasa a `agotado`.

### Venta (POS / entrega de pedido)
- El pedido agendado **no** reserva lotes. Se asignan al entregar, cuando se pesa lo real.
- RPC de lectura `sugerir_lotes(producto_id, peso_kg)` → asignación PEPS (`fecha_ingreso`, luego `codigo`) entre lotes `abierto` con stock: `[{lote_id, codigo, fecha_ingreso, disponible_kg, peso_kg}]`, **sin costos**. Si el stock total no alcanza, lo indica (la venta no se puede emitir).
- La UI muestra la propuesta por línea y permite editarla. `registrar_factura` recibe la asignación final o, si no viene, la calcula ella misma con PEPS. Valida que `Σ asignación = peso del item`, que cada lote sea del producto, que esté abierto y que alcance su stock (bajo lock). Calcula el costo desde los lotes (**ya no lo manda el servicio**) y escribe `factura_item_lotes` + un movimiento `venta` por asignación.

### Pérdidas y cierre de lote
- `registrar_perdida(lote_id, peso_kg, motivo, detalle)`: cualquier usuario autenticado; valida stock, escribe `perdidas_lote` + movimiento `perdida` al costo del lote.
- **Cerrar lote**: da de baja todo el remanente como pérdida con motivo `cierre` y marca `cerrado`. Sirve para el sobrante de pocos gramos que no se va a vender. Pide confirmación mostrando los kg que se dan de baja.

### Trazabilidad y resultado por lote (solo admin para importes)
Para un lote crudo se consolida su **árbol** (el lote y sus lotes procesados hijos):

| Bloque | Contenido |
|---|---|
| Entrada | compra (proveedor, fecha, kg, costo/kg, moneda, tasa de compra) |
| Procesamientos | kg de entrada → salida, merma kg y %, rendimiento, lote hijo generado |
| Ventas | por asignación: factura, cliente, fecha, kg, precio/kg, tasa de la factura |
| Pérdidas | fecha, kg, motivo, usuario |
| Devoluciones | notas de crédito que regresaron kg al lote |
| Saldo | kg restantes por lote del árbol y su valor |

Resultado (para kg vendidos y perdidos):
- **USD**: `ingreso_usd − costo_vendido_usd − costo_perdido_usd`.
- **Bs a tasas históricas**: `Σ(venta_usd × tasa_factura) − Σ(costo_usd × tasa_compra_del_lote)` (vendido + perdido).
- **Efecto cambiario del lote** = resultado en Bs − resultado USD × tasa de compra. Muestra cuánto del resultado en Bs se debe al cambio de tasa entre que se compró y se vendió.
- No se mezcla con la ganancia cambiaria de cobros (`/SPEC.md` §4.5): esa sigue en `/cobros` y depende de cuándo paga el cliente, no del lote.

### Valorización
- Stock de un producto = `Σ stock de sus lotes`; valor USD = `Σ(stock_lote × costo_lote)`; valor Bs a la tasa vigente.
- El valor de inventario cambia: con lotes, un producto con un lote viejo barato y uno nuevo caro vale exactamente lo que costaron sus kg, no el promedio.

## Arranque de datos (decidido el 2026-10-07)

**La base solo tiene datos de prueba** (confirmado por el usuario), así que **no se migra el stock existente a lotes**: se empieza limpio.
- Una migración vacía los datos transaccionales de prueba: `movimientos`, `compra_items`, `compras`, `pagos_proveedores`, `proceso_items`, `procesamientos`, `factura_items`, `pagos`, `nota_credito_items`, `notas_credito`, `facturas`, `pedido_items`, `pedidos` (en orden de dependencias) y reinicia la secuencia de números de factura.
- **Se conservan** usuarios y perfiles, clientes, proveedores (con sus representantes, métodos de pago y documentos), productos, `tasas` y `config_negocio`.
- Con el ledger vacío, los checks de lote se crean **validados** desde el inicio (no hace falta `not valid`), y el origen `inicial` de `lotes` no se usa (se deja en el check por si algún día se carga un inventario de apertura).
- **Antes de aplicarla en Supabase, confirmar otra vez con el usuario** que no entró ningún dato real desde el 2026-10-07: es un borrado irreversible.

## Pantallas

### `/compras` (cambio)
- Al guardar: diálogo de confirmación "Lotes creados" con el código grande de cada línea (producto, kg) y botón **copiar código**, para rotular. En el listado de compras, chips con los códigos de lote de cada compra.

### `/procesamiento` (cambio)
- Después de elegir el crudo: `Autocomplete` de **lote** (código, fecha de ingreso, días en cava, proveedor, kg disponibles), con el más antiguo preseleccionado. Los lotes que superan `dias_alerta_lote` llevan chip "antiguo".
- "Usar todo el lote" precarga el peso de entrada con el stock del lote, en vez del stock del producto como ahora.
- Al guardar se muestra el código del lote procesado generado.

### POS / entrega de pedido (cambio)
- Por línea, al ingresar el peso: chip "Lote SALM-261005-1 · 3,000 kg" (o varios chips si la venta se reparte), propuesto por PEPS.
- "Cambiar lotes" abre un diálogo con los lotes abiertos del producto: kg asignados por lote, total que debe cuadrar con el peso y aviso en vivo si no cuadra o si excede el stock.
- Si no hay stock suficiente en lotes, la línea muestra un error y no se puede emitir (hoy se puede vender sin stock; ver "Hallazgos").

### `/inventario` (nueva; reemplaza el placeholder y las tareas 16–19 de `04`)
- Pestaña **Productos**: kg en stock, lotes abiertos, lote más antiguo (días), alerta de stock bajo; costo promedio informativo y valor USD/Bs solo para admin. La fila se expande y muestra sus lotes.
- Pestaña **Lotes**: DataGrid de lotes (código, producto, proveedor, ingreso, días, kg inicial → actual con barra de % restante, estado), filtros por estado/producto/proveedor, búsqueda por código. Acciones: registrar pérdida, cerrar lote, ver trazabilidad.
- Columnas secundarias ocultas en móvil; la búsqueda por código es lo primero en `xs` (se usa parado frente a la cava).

### `/inventario/lotes/[id]` (nueva)
- Encabezado: código grande + copiar, producto, proveedor, estado, días en cava, kg restantes/iniciales.
- Línea de tiempo (`Timeline` simple con `List`, sin dependencias nuevas): compra → procesamientos → ventas → pérdidas → devoluciones, con enlaces al lote padre o hijo, a la factura y a la compra.
- Tarjeta de **resultado** (solo admin): USD, Bs a tasas históricas y efecto cambiario. Para un lote crudo, consolidado con sus hijos.

## Hallazgos sobre lo ya implementado (se corrigen dentro de este módulo)

1. **Costo de venta en 0 cuando vende un operador**: `invoiceService` toma el costo con `getStockProducto`, que lee `movimientos_view`. Para el operador esa vista devuelve `costo_usd_kg = null` (`0003`), así que el snapshot de costo de la factura (y el margen) queda mal. Con lotes, el costo lo calcula la RPC (`security definer`) y el servicio deja de leerlo.
2. **Se puede vender más de lo que hay en stock**: `registrar_factura` (`0016`) no valida stock ni toma el lock que `0013` dejó indicado para ventas. La nueva RPC valida stock por lote bajo lock.

## Fuera de alcance (MVP)

- Impresión de etiquetas o códigos de barras/QR del lote (el código es legible para escribirlo a mano; queda listo para una etiqueta después).
- Mezclar lotes crudos en un mismo procesado (decisión cerrada arriba).
- Reservar lotes al crear un pedido agendado.
- Fechas de vencimiento por lote (solo antigüedad por días).
- Anulación de compras o procesamientos (sigue siendo deuda de `04-inventario`; con lotes, anular exigirá que el lote no tenga salidas).
