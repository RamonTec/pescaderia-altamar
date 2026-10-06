# Checklist — 04-ventas

## Pedidos / POS
- [ ] Crear un pedido agendado guarda items con peso estimado, sin afectar stock todavía.
- [ ] Venta directa (POS) genera factura inmediatamente con el peso real pesado.
- [ ] Entregar un pedido pendiente captura el peso real y genera la factura con esos kg (no con el estimado).
- [ ] Intentar una venta a crédito que excede `limite_credito_usd` del cliente dispara la advertencia definida (bloqueo o confirmación, según lo decidido).

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
- [ ] El saldo pendiente por cliente (consumido por `02-clientes`) refleja la suma correcta de todas sus facturas abiertas.

## General
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] Ninguna pantalla de este módulo sigue siendo el placeholder original.
- [ ] La ficha de cliente en `02-clientes` ya no muestra `—` en saldo pendiente.

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha)_
