# Checklist — 07-lotes

> _2026-10-07, ejecutor_: módulo implementado (tareas 1–21). Las migraciones **no se aplicaron** en Supabase (el borrado de datos de prueba requiere confirmación del usuario) y no se probó con la app corriendo ni con sesiones reales: los ítems que dependen de eso quedan sin marcar con su estado. La lógica SQL se ensayó en un Postgres 16 local desechable (Docker, stubs de `auth`), ver la nota de la Fase A en `tasks.md`.

## Datos y seguridad
- [x] Migraciones aplicadas; datos transaccionales de prueba vaciados (con confirmación previa del usuario) y catálogos, clientes, proveedores, tasas y configuración intactos.
  - _2026-10-07_: el usuario confirmó que solo había datos de prueba y aplicó `20261007180000_lotes_reinicio_datos_prueba.sql` … `20261007180400_lotes_rpc_ventas.sql`. Verificado por PostgREST: clientes 3, proveedores 3, productos 6, tasas 4, `config_negocio` 1; compras, facturas, pedidos, notas de crédito, movimientos, lotes, `factura_item_lotes`, `perdidas_lote` y `recordatorios_cobro` en 0; `lotes_view`, `lotes_stock` y `factura_item_lotes_view` existen.
- [x] Cada línea de compra crea un lote con código legible y único; cada línea de procesamiento crea un lote procesado ligado a su lote padre.
  - _Implementado_ (`registrar_compra` / `registrar_procesamiento` + `generar_codigo_lote` bajo advisory lock por producto y día). Verificado en Postgres local (`SALM-261005-1`, `FSAL-261007-1` con `lote_padre`); falta en Supabase (tareas 23–24).
- [x] Ningún lote queda con stock negativo, ni con dos operaciones simultáneas (lock de la fila del lote verificado).
  - _Implementado_ (`select … for update` del lote en todas las RPC que restan stock). Verificado en Postgres local con dos ventas concurrentes (la segunda falla con `stock_insuficiente`); falta la tarea 30 en Supabase.
- [x] El operador no puede leer el costo de lotes ni de asignaciones (UI y PostgREST directo).
  - _Implementado_: `revoke select` de `lotes` y `factura_item_lotes`; `lotes_view` / `factura_item_lotes_view` anulan el costo si `not es_admin()`; las páginas además quitan costos del payload. Verificado en Postgres local (operador: costo `null`, `permission denied for table lotes`). Falta con sesión real (tarea 29).
- [x] `lotes`, `factura_item_lotes` y `perdidas_lote` solo se escriben vía RPC.
  - Sin políticas de insert/update/delete en esas tablas (ni en `nota_credito_item_lotes`); se retiró además la política `write_all` de `movimientos` para que el ledger tampoco se escriba directo. Todas las escrituras son RPC `security definer`.

## Costeo por lote
- [x] El costo de un lote de compra es el del item; el de un lote procesado es `costo_total_origen / peso_salida`, y no cambia con compras posteriores.
  - _Implementado_ (`lotes.costo_usd_kg` fijo). Verificado en Postgres local (B1 = 220 / 15 = 14,666667); falta en Supabase (tarea 24).
- [x] Vender o perder kg usa el costo del lote de origen; `factura_items.costo_usd_kg` es el promedio de su asignación.
  - _Implementado_. Verificado en Postgres local (`10,142857 = (300 + 55) / 35`); falta en Supabase (tarea 25).
- [x] La valorización del inventario es `Σ(stock_lote × costo_lote)`; el costo promedio por producto es solo informativo.
  - _Implementado_ (`costingService.valorizarLotes`); falta verlo en `/inventario` con datos reales.
- [x] `/SPEC.md` §2, §4 y §5 reflejan el costeo por lote (decisión reabierta el 2026-10-07).

## Procesamiento
- [x] El operador elige el lote crudo; se preselecciona el más antiguo y se avisa si es "antiguo".
  - _Implementado_ (`LoteAutocomplete` en `ProcesamientoForm`, PEPS preseleccionado, chip "Antiguo" con `dias_alerta_lote`); falta probar en la app.
- [x] No se puede procesar más kg que el stock del lote elegido.
  - _Implementado_ (aviso en vivo, servicio y RPC bajo lock). Falta probar en la app.
- [x] La merma y el rendimiento quedan registrados por lote y aparecen en su trazabilidad.
  - _Implementado_ (`proceso_items.lote_origen_id`, evento de procesamiento en `LoteTimeline`, merma/rendimiento en `ResultadoLoteCard`). Falta probar (tarea 28).

## Ventas
- [x] POS y entrega de pedido proponen lotes PEPS; si un lote no alcanza, se completa con el siguiente.
  - _Implementado_ (`LotesLineaVenta` → `sugerir_lotes`; la RPC aplica PEPS si no llega asignación). Falta probar en la app (tarea 25).
- [x] El vendedor puede cambiar la asignación; la venta respeta su elección y valida que cuadre con el peso.
  - _Implementado_ (`AsignacionLotesPanel` en línea; zod `validarAsignacion`; RPC `asignacion_no_cuadra`). Verificado en Postgres local; falta en la app.
- [x] Sin stock suficiente en lotes, la venta no se puede emitir (hallazgo 2 corregido).
  - _Implementado_ (botón de emitir deshabilitado + aviso; la RPC rechaza con `stock_insuficiente`). Verificado en Postgres local; falta en la app.
- [x] Una venta registrada por un operador guarda el costo correcto (hallazgo 1 corregido).
  - _Implementado_: el servicio ya no lee costo; lo calcula `registrar_factura` (`security definer`). Falta probar con sesión real de operador (tarea 29).
- [x] Nota de crédito con `afecta_inventario` devuelve kg a los lotes de origen; anularla lo revierte.
  - _Implementado_ (orden inverso de la asignación, `nota_credito_item_lotes`, reabre el lote). Verificado en Postgres local; falta en Supabase (tarea 27).

## Pérdidas y cierre
- [x] Cualquier usuario registra una pérdida con kg y motivo; no puede superar el stock del lote.
  - _Implementado_ (`PerdidaLoteDialog`, `registrar_perdida`). Falta probar en la app (tarea 26).
- [x] Cerrar un lote da de baja el remanente (motivo `cierre`) tras confirmar los kg.
  - _Implementado_ (`ConfirmDialog` con los kg; `cerrar_lote` falla si el stock cambió desde la confirmación). Verificado en Postgres local; falta en la app.
- [x] Un lote pasa a `agotado` solo al llegar a 0 kg y vuelve a `abierto` si recibe una devolución.
  - _Implementado_ (`lote_sincronizar_estado`; la devolución reabre también un lote `cerrado`, que no puede tener stock). Verificado en Postgres local.

## Trazabilidad
- [x] La ficha del lote muestra compra, procesamientos, ventas, pérdidas y devoluciones con enlaces a padre, hijos, factura y compra.
  - _Implementado_ (`/inventario/lotes/[id]`, `LoteTimeline`). No hay pantalla de detalle de factura ni de compra: la venta enlaza a la ficha del cliente (que lista sus facturas) y la compra al listado `/compras`. Falta probar en la app.
- [x] El resultado USD, en Bs a tasas históricas y el efecto cambiario coinciden con el cálculo a mano de la tarea 28; para un lote crudo incluyen a sus hijos.
  - _Implementado_ (`resultadoLote`, puro). Ensayado con los datos de la tarea 28 (B + B1: resultado −49,666667 USD; Bs −1.861,00; efecto cambiario 225 Bs = 5 kg × 15 × (45 − 42)). Falta con datos reales.

## UI/UX
- [x] Los códigos de lote se muestran al guardar una compra o un procesamiento y se pueden copiar.
  - _Implementado_ (`LotesCreadosDialog` + `CopyableText variant="h5"`; chips en `ComprasTable` y `ProcesamientosTable`). Falta probar en la app.
- [x] `/inventario`: pestañas Productos y Lotes, búsqueda por código, filtros, % restante, lotes antiguos destacados, `EmptyState`/`loading.tsx`/`error.tsx`.
  - _Implementado_. Falta probar en la app.
- [x] Responsive a 375 px (búsqueda por código primero, columnas secundarias ocultas) y modo claro/oscuro revisados.
  - _Implementado_ (tarjetas `mobileCard` en `xs`, columnas ocultas en `md−`, solo tokens del theme). **Sin revisar visualmente**: requiere la app corriendo.
- [x] Loaders internos en botones, toasts en toda escritura, `ConfirmDialog` al cerrar un lote, `Collapse`/`Fade` con tokens del theme.
  - _Implementado_ (`loading` en `PerdidaLoteDialog`, `RowActionsMenu pending`, toasts en pérdida/cierre/compra/procesamiento, `Collapse` en filas de Productos y en la edición de lotes, `Fade` en la ficha). Falta revisión visual.

## Cierre
- [x] Tareas 16–19 de `04-inventario` marcadas como absorbidas por este módulo.
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores. _(2026-10-07)_

## Pendientes / deuda técnica
- [x] _(2026-10-07)_ ~~Aplicar las migraciones (tarea 22)~~ hecho el 2026-10-07. Falta ejecutar las tareas 23–30 con la app y sesiones reales de admin y operador.
- [x] _(2026-10-07)_ Desvío tarea 16: la "asignación de lotes" es un panel en línea (`AsignacionLotesPanel`), no `AsignacionLotesDialog`, por la regla de `00-estandares-ui` que prohíbe abrir un diálogo de formulario desde otro (POS y entrega ya son diálogos).
- [x] _(2026-10-07)_ Productos con `controla_stock = false`: no usan lotes; su venta registra costo 0 (antes, promedio ponderado) y un crudo sin control de stock no se puede procesar (el procesamiento exige lote). Si el negocio vende algo así con costo, definir cómo costearlo.
- [x] _(2026-10-07)_ `proceso_items.costo_total_usd` sigue legible por RLS para el operador (deuda previa de 04-inventario): las páginas lo quitan del payload, pero por PostgREST directo se ve. Considerar una vista protegida como `lotes_view`.
- [x] _(2026-10-07)_ Si un lote **cerrado** recibe una devolución se reabre; si después se anula esa nota, queda `agotado` y no vuelve a `cerrado`.
- [x] _(2026-10-07)_ La pestaña Productos de `/inventario` usa `Table` de MUI (filas expandibles), no `AppDataGrid`: el `DataGrid` gratuito no tiene detail panel.
- [x] _(2026-10-07)_ Los tipos de `supabase-js` no están generados: los repositorios de lotes castean las filas embebidas (`as unknown as`), igual que el resto del proyecto.
