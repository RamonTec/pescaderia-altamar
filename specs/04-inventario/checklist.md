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
- [ ] El costo ponderado tras una segunda compra del mismo producto coincide con la fórmula de `/SPEC.md` §4.1 (verificado a mano, ver tarea 22 de `tasks.md`).

## Procesamiento
- [ ] Procesar un lote baja el stock del producto origen y sube el del producto destino con el costo correcto (fórmula de transferencia total de costo).
- [ ] `merma_kg` y `rendimiento` se muestran y coinciden con los pesos ingresados.
- [ ] No se puede registrar `peso_salida_kg > peso_entrada_kg` (constraint de BD + validación en UI con mensaje claro).

## Inventario
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
- [ ] **(2026-10-06) Aplicar `0012_compras_registro.sql`** en el proyecto Supabase real (SQL Editor). Sin esta migración, registrar compras y pagos falla porque las RPC no existen.
- [ ] (2026-10-06) `compras.subtotal_usd`/`pagado_usd` siguen legibles para el operador vía PostgREST (RLS `read_all` de `0001`). La UI no se los envía, pero la protección en la base queda pendiente (vista o columnas separadas, mismo enfoque que `0003`).
- [ ] (2026-10-06) Sin anulación de compras: `estado = 'anulada'` existe en el esquema, pero revertir los movimientos de stock y los pagos no está en el alcance de las tareas 5–11.
- [ ] (2026-10-06) El listado de `/proveedores` sigue con la columna "Saldo pendiente" en `—` (oculta por defecto); solo la ficha consume `proveedorBalanceService`.
