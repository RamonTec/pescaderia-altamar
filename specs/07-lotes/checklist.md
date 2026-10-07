# Checklist — 07-lotes

## Datos y seguridad
- [ ] Migraciones aplicadas; datos transaccionales de prueba vaciados (con confirmación previa del usuario) y catálogos, clientes, proveedores, tasas y configuración intactos.
- [ ] Cada línea de compra crea un lote con código legible y único; cada línea de procesamiento crea un lote procesado ligado a su lote padre.
- [ ] Ningún lote queda con stock negativo, ni con dos operaciones simultáneas (lock de la fila del lote verificado).
- [ ] El operador no puede leer el costo de lotes ni de asignaciones (UI y PostgREST directo).
- [ ] `lotes`, `factura_item_lotes` y `perdidas_lote` solo se escriben vía RPC.

## Costeo por lote
- [ ] El costo de un lote de compra es el del item; el de un lote procesado es `costo_total_origen / peso_salida`, y no cambia con compras posteriores.
- [ ] Vender o perder kg usa el costo del lote de origen; `factura_items.costo_usd_kg` es el promedio de su asignación.
- [ ] La valorización del inventario es `Σ(stock_lote × costo_lote)`; el costo promedio por producto es solo informativo.
- [ ] `/SPEC.md` §2, §4 y §5 reflejan el costeo por lote (decisión reabierta el 2026-10-07).

## Procesamiento
- [ ] El operador elige el lote crudo; se preselecciona el más antiguo y se avisa si es "antiguo".
- [ ] No se puede procesar más kg que el stock del lote elegido.
- [ ] La merma y el rendimiento quedan registrados por lote y aparecen en su trazabilidad.

## Ventas
- [ ] POS y entrega de pedido proponen lotes PEPS; si un lote no alcanza, se completa con el siguiente.
- [ ] El vendedor puede cambiar la asignación; la venta respeta su elección y valida que cuadre con el peso.
- [ ] Sin stock suficiente en lotes, la venta no se puede emitir (hallazgo 2 corregido).
- [ ] Una venta registrada por un operador guarda el costo correcto (hallazgo 1 corregido).
- [ ] Nota de crédito con `afecta_inventario` devuelve kg a los lotes de origen; anularla lo revierte.

## Pérdidas y cierre
- [ ] Cualquier usuario registra una pérdida con kg y motivo; no puede superar el stock del lote.
- [ ] Cerrar un lote da de baja el remanente (motivo `cierre`) tras confirmar los kg.
- [ ] Un lote pasa a `agotado` solo al llegar a 0 kg y vuelve a `abierto` si recibe una devolución.

## Trazabilidad
- [ ] La ficha del lote muestra compra, procesamientos, ventas, pérdidas y devoluciones con enlaces a padre, hijos, factura y compra.
- [ ] El resultado USD, en Bs a tasas históricas y el efecto cambiario coinciden con el cálculo a mano de la tarea 28; para un lote crudo incluyen a sus hijos.

## UI/UX
- [ ] Los códigos de lote se muestran al guardar una compra o un procesamiento y se pueden copiar.
- [ ] `/inventario`: pestañas Productos y Lotes, búsqueda por código, filtros, % restante, lotes antiguos destacados, `EmptyState`/`loading.tsx`/`error.tsx`.
- [ ] Responsive a 375 px (búsqueda por código primero, columnas secundarias ocultas) y modo claro/oscuro revisados.
- [ ] Loaders internos en botones, toasts en toda escritura, `ConfirmDialog` al cerrar un lote, `Collapse`/`Fade` con tokens del theme.

## Cierre
- [ ] Tareas 16–19 de `04-inventario` marcadas como absorbidas por este módulo.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores.

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha)_
