# Checklist — 05-ventas

## Pedidos / POS
- [ ] Crear un pedido agendado guarda items con peso estimado, sin afectar stock todavía.
- [ ] Venta directa (POS) genera factura inmediatamente con el peso real pesado.
- [ ] Entregar un pedido pendiente captura el peso real y genera la factura con esos kg (no con el estimado).
- [ ] Intentar una venta a crédito a un cliente `bloqueado` se rechaza siempre, sin opción de forzar desde esta pantalla.
- [ ] Intentar una venta a crédito que excede `limite_credito_usd` del cliente dispara la advertencia (soft-warning con confirmación).

## Facturación
- [ ] El número de factura es secuencial y nunca se repite, incluso con dos facturas creadas casi simultáneamente.
- [ ] Subtotal, IVA y total se calculan correctamente según `iva_pct` vigente.
- [ ] `tasa_snapshot` queda congelada en la factura y no cambia si la tasa del día cambia después.
- [ ] `costo_usd_kg` por item queda guardado como snapshot al momento de la venta (verificar que si el costo promedio cambia después, la factura vieja no cambia).
- [ ] Emitir una factura descuenta el stock correcto en `movimientos` (tipo `venta`).
- [ ] Factura `contado` nace pagada; factura `credito` nace abierta.

## Cobros
- [ ] Registrar un abono actualiza `pagado_usd` y, si corresponde, marca la factura como `pagada`.
- [ ] La ganancia/pérdida cambiaria se calcula igual que en `/SPEC.md` §4.5 y coincide con el ejemplo de verificación en `tasks.md`.
- [ ] El saldo pendiente por cliente (consumido por `02-clientes`) refleja la suma correcta de todas sus facturas abiertas, restando notas de crédito emitidas.

## Notas de crédito
- [ ] Emitir una nota de crédito nunca modifica la factura original (sus columnas quedan exactamente igual antes y después).
- [ ] No se puede devolver más peso del que tiene la factura (ni en una sola nota ni acumulando varias notas sobre la misma factura).
- [ ] Una nota con `afecta_inventario = true` sube el stock del producto al costo que tenía la venta original, no al costo promedio actual.
- [ ] Una nota con `afecta_inventario = false` no genera ningún movimiento de inventario, solo el ajuste de saldo.
- [ ] El saldo pendiente del cliente baja (o queda a favor) inmediatamente después de emitir la nota.
- [ ] Anular una nota de crédito revierte su efecto en el saldo (y en inventario si aplicaba) — no solo cambia una etiqueta de estado.

## General
- [ ] Todas las pantallas de este módulo siguen los estándares de `00-estandares-ui` (loaders, estados vacíos, confirmaciones, notificaciones, formato de números).
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] Ninguna pantalla de este módulo sigue siendo el placeholder original.
- [ ] La ficha de cliente en `02-clientes` ya no muestra `—` en saldo pendiente.

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha)_
