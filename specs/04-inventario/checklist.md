# Checklist — 04-inventario

## Catálogo
- [ ] CRUD de productos funciona (crear, editar, desactivar) y distingue crudo/procesado.
- [ ] (Movido a `03-proveedores`: CRUD, bloqueo y ficha de proveedor viven allí; aquí solo se consume la selección en Compras.)
- [ ] Configuración (IVA, fuente de tasa, umbral de stock bajo) se puede editar y persiste.

## Compras
- [ ] Registrar una compra crea la fila en `compras`, sus `compra_items` y un movimiento `compra` por cada item en `movimientos`. *(implementado: RPC `registrar_compra` en `0012`, una sola transacción; falta aplicar `0012` y verificar)*
- [ ] La tasa usada queda "congelada" en `compras.tasa_snapshot` (no cambia si después cambia la tasa del día). *(implementado: el servicio guarda la tasa del formulario; nada la recalcula)*
- [ ] Compra `contado` queda con `pagado_usd = subtotal_usd` automáticamente. *(implementado en `compraService.crearCompra`, con `estado = 'pagada'`)*
- [ ] Compra `credito` queda abierta y permite registrar pagos parciales con su propia tasa y ganancia cambiaria calculada. *(implementado: `PagoProveedorDialog` + RPC `registrar_pago_proveedor`, solo admin; falta verificación manual)*
- [ ] Intentar una compra a crédito con un proveedor `bloqueado` (de `03-proveedores`) se rechaza siempre. *(servicio + trigger `compras_guard_proveedor_bloqueado`; la UI deshabilita "Crédito")*
- [ ] El saldo pendiente por proveedor (`proveedorBalanceService`, consumido por `03-proveedores`) refleja la suma correcta de todas sus compras abiertas. *(implementado; la ficha ya lo consume)*
- [ ] El costo ponderado tras una segunda compra del mismo producto coincide con la fórmula de `/SPEC.md` §4.1 (verificado a mano, ver tarea 22 de `tasks.md`). *(2026-10-07: obsoleto, el costeo pasa a ser por lote; se verifica en `07-lotes`, tarea 23)*

## Procesamiento
- [ ] Procesar un lote baja el stock del producto origen y sube el del producto destino con el costo correcto (fórmula de transferencia total de costo). *(implementado: RPC `registrar_procesamiento` en `0013`; falta aplicar `0013` y verificar con la tarea 21)*
- [ ] `merma_kg` y `rendimiento` se muestran y coinciden con los pesos ingresados. *(implementado: en vivo en `ProcesamientoForm` y en `ProcesamientosTable`; falta verificación manual)*
- [ ] No se puede registrar `peso_salida_kg > peso_entrada_kg` (constraint de BD + validación en UI con mensaje claro). *(implementado: aviso en vivo + zod `superRefine` + servicio + constraint `salida_menor_entrada` mapeado al campo; falta verificación manual)*

## Inventario
*(2026-10-07: la pantalla `/inventario` se construye en `07-lotes`; estos ítems se marcan al cerrar ese módulo.)*
*(2026-10-07, ejecutor de 07-lotes: implementada — pestaña Productos con kg, lotes, costo promedio informativo y valor USD/Bs a la tasa vigente solo para admin, chip "Stock bajo". Sin marcar: falta aplicar las migraciones de 07 y verificar con sesión real de admin y de operador; el historial de movimientos por producto (tarea 19) lo reemplaza la trazabilidad por lote en `/inventario/lotes/[id]`.)*
- [ ] La tabla de stock muestra kg, costo promedio y valor (USD y Bs) por producto, usando la tasa vigente.
- [ ] Un usuario `operador` ve kg en stock pero no ve costo ni valor (verificado con sesión real de operador, no solo asumido).
- [ ] Productos bajo el umbral de stock configurado se distinguen visualmente.
- [ ] El historial de movimientos de un producto es consistente con las compras/procesamientos/ventas registradas (suma de movimientos = stock actual).

## General
- [ ] Todas las pantallas de este módulo siguen los estándares de `00-estandares-ui` (loaders, estados vacíos, confirmaciones, notificaciones, formato de números).
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] Ninguna pantalla de este módulo sigue siendo el placeholder original (`PagePlaceholder`).
- [ ] La ficha de proveedor en `03-proveedores` ya no muestra `—` en saldo pendiente.

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha)_
- [x] **(2026-10-06) Aplicar `0012_compras_registro.sql`** en el proyecto Supabase real (SQL Editor). Sin esta migración, registrar compras y pagos falla porque las RPC no existen.
- [ ] (2026-10-06) `compras.subtotal_usd`/`pagado_usd` siguen legibles para el operador vía PostgREST (RLS `read_all` de `0001`). La UI no se los envía, pero la protección en la base queda pendiente (vista o columnas separadas, mismo enfoque que `0003`).
- [ ] (2026-10-06) Sin anulación de compras: `estado = 'anulada'` existe en el esquema, pero revertir los movimientos de stock y los pagos no está en el alcance de las tareas 5–11.
- [x] **(2026-10-06) Aplicar `0017_fix_stock_y_costo_producto.sql`** (aplicada como "0015"; renombrada para no chocar con `0015_facturas_secuencia.sql` de `05-ventas`): `stock_y_costo_producto` de `0013` fallaba con 42702 (OUT `costo_usd_kg` ambiguo con la columna) y ningún procesamiento se podía registrar.
- [x] **(2026-10-06) Aplicar `0013_procesamiento_registro.sql` y luego `0014_producto_origen.sql`** en el proyecto Supabase real (después de `0012`). Sin ellas, registrar procesamientos falla y Catálogos no puede guardar productos (columna `producto_origen_id`).
- [ ] (2026-10-06) Tras aplicar `0014`, asignar "Se obtiene de" a los procesados que no sean los demo (en Catálogos aparecen como "Sin crudo asignado"); hasta entonces no se pueden elegir como salida. Luego se puede validar el check con `alter table productos validate constraint productos_origen_segun_tipo`.
- [ ] (2026-10-06) `proceso_items.costo_total_usd` sigue legible para el operador vía PostgREST (RLS `read_all` de `0001`). La página no se lo envía; misma deuda que `compras.subtotal_usd`.
- [ ] (2026-10-06) Sin anulación de procesamientos (revertir `proceso_out`/`proceso_in`): fuera del alcance de las tareas 12–15.
- [ ] (2026-10-06) El listado de `/proveedores` sigue con la columna "Saldo pendiente" en `—` (oculta por defecto); solo la ficha consume `proveedorBalanceService`.
