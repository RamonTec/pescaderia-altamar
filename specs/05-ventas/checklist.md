# Checklist — 05-ventas

## Pedidos / POS
- [x] Crear un pedido agendado guarda items con peso estimado, sin afectar stock todavía.
- [x] Venta directa (POS) genera factura inmediatamente con el peso real pesado.
- [x] Entregar un pedido pendiente captura el peso real y genera la factura con esos kg (no con el estimado).
- [x] Intentar una venta a crédito a un cliente `bloqueado` se rechaza siempre, sin opción de forzar desde esta pantalla.
- [x] Intentar una venta a crédito que excede `limite_credito_usd` del cliente dispara la advertencia (soft-warning con confirmación).

## Facturación
- [x] El número de factura es secuencial y nunca se repite, incluso con dos facturas creadas casi simultáneamente.
- [x] Subtotal, IVA y total se calculan correctamente según `iva_pct` vigente.
- [x] `tasa_snapshot` queda congelada en la factura y no cambia si la tasa del día cambia después.
- [x] `costo_usd_kg` por item queda guardado como snapshot al momento de la venta (verificar que si el costo promedio cambia después, la factura vieja no cambia).
- [x] Emitir una factura descuenta el stock correcto en `movimientos` (tipo `venta`).
- [x] Factura `contado` nace pagada; factura `credito` nace abierta.

## Cobros
- [x] Registrar un abono actualiza `pagado_usd` y, si corresponde, marca la factura como `pagada`.
- [x] La ganancia/pérdida cambiaria se calcula igual que en `/SPEC.md` §4.5 y coincide con el ejemplo de verificación en `tasks.md`.
- [x] El saldo pendiente por cliente (consumido por `02-clientes`) refleja la suma correcta de todas sus facturas abiertas, restando notas de crédito emitidas.

## Notas de crédito
- [x] Emitir una nota de crédito nunca modifica la factura original (sus columnas quedan exactamente igual antes y después).
- [x] No se puede devolver más peso del que tiene la factura (ni en una sola nota ni acumulando varias notas sobre la misma factura).
- [x] Una nota con `afecta_inventario = true` sube el stock del producto al costo que tenía la venta original, no al costo promedio actual.
- [x] Una nota con `afecta_inventario = false` no genera ningún movimiento de inventario, solo el ajuste de saldo.
- [x] El saldo pendiente del cliente baja (o queda a favor) inmediatamente después de emitir la nota.
- [x] Anular una nota de crédito revierte su efecto en el saldo (y en inventario si aplicaba) — no solo cambia una etiqueta de estado.

## General
- [x] Todas las pantallas de este módulo siguen los estándares de `00-estandares-ui` (loaders, estados vacíos, confirmaciones, notificaciones, formato de números).
- [x] `npm run lint` y `npx tsc --noEmit` sin errores.
- [x] Ninguna pantalla de este módulo sigue siendo el placeholder original.
- [x] La ficha de cliente en `02-clientes` ya no muestra `—` en saldo pendiente.

## Pendientes / deuda técnica
- [x] **(2026-10-06) Aplicar migraciones `0015_facturas_secuencia.sql` y `0016_notas_credito_y_rpc_ventas.sql`** en el proyecto Supabase real (SQL Editor / `db push`). Sin estas, todo el módulo falla porque las RPC no existen y `facturas.numero` no tiene secuencia. _(Aplicadas; confirmado por el usuario el 2026-10-07.)_
- [ ] **(2026-10-06) Verificación manual** de `tasks.md` 21–23 contra una base real (IVA 16%, ganancia cambiaria 27 Bs, nota parcial de 2 kg) — no se pudo correr sin acceso al proyecto Supabase.
- [ ] **(2026-10-06) `facturas`/`pagos`/`pedidos` siguen legibles para el operador vía PostgREST** (RLS `read_all` de `0001`). La UI no envía importes al operador en `/cobros`, pero la protección de columna en la base queda pendiente (mismo enfoque que `0003` para `factura_items`, pendiente para `facturas.subtotal/iva/total/pagado` y `pagos`).
- [ ] **(2026-10-06) Nota de crédito accesible desde la ficha de la factura**: hoy se emite desde `/notas-credito`. No existe ficha de factura propia; el spec pedía "emitir nota de crédito" también desde ahí. Se difiere hasta que exista una pantalla de detalle de factura.
