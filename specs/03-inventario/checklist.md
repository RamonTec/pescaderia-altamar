# Checklist — 03-inventario

## Catálogo
- [ ] CRUD de productos funciona (crear, editar, desactivar) y distingue crudo/procesado.
- [ ] CRUD de proveedores funciona.
- [ ] Configuración (IVA, fuente de tasa, umbral de stock bajo) se puede editar y persiste.

## Compras
- [ ] Registrar una compra crea la fila en `compras`, sus `compra_items` y un movimiento `compra` por cada item en `movimientos`.
- [ ] La tasa usada queda "congelada" en `compras.tasa_snapshot` (no cambia si después cambia la tasa del día).
- [ ] Compra `contado` queda con `pagado_usd = subtotal_usd` automáticamente.
- [ ] Compra `credito` queda abierta y permite registrar pagos parciales con su propia tasa y ganancia cambiaria calculada.
- [ ] El costo ponderado tras una segunda compra del mismo producto coincide con la fórmula de `/SPEC.md` §4.1 (verificado a mano, ver tarea 21 de `tasks.md`).

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
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] Ninguna pantalla de este módulo sigue siendo el placeholder original (`PagePlaceholder`).

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha)_
