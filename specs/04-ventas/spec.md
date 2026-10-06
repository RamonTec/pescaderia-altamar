# 04 — Ventas (Pedidos/POS, facturación, cobros)

## Contexto

Cubre `/SPEC.md` §4.4–4.6: pedidos agendados + venta directa (POS), facturación interna con IVA desglosado, y cobros con ganancia cambiaria. El esquema ya existe (`pedidos`, `pedido_items`, `facturas`, `factura_items`, `pagos`). `creditService.ts` ya tiene `gananciaCambiariaBs`, `usdEquivalentes`, `saldoPendiente`. Falta todo lo demás: repositorios, `InvoiceService`, y las pantallas `/pedidos` y `/cobros` (hoy placeholders).

Depende de `02-clientes` (para seleccionar cliente) y `03-inventario` (para descontar stock al vender vía `movimientoService`).

## Alcance

### 4.1 Pedidos / POS (`/pedidos`)
- **Pedido agendado**: cliente + fecha de entrega + items (producto, peso estimado, precio_usd_kg pactado). Estado `pendiente`.
- **Venta directa (POS)**: mismo formulario pero sin fecha de entrega futura — se pesa y factura en el mismo paso. Puede ser el mismo formulario con un toggle "entrega inmediata", o una vista separada simplificada — decisión de UI libre siempre que ambos flujos terminen en la misma `InvoiceService.crearFactura(...)`.
- Al **entregar** un pedido pendiente: capturar `peso_entregado_kg` real por item, generar la factura con esos kg (no con el estimado).
- Antes de generar una factura a crédito, verificar `clientes.limite_credito_usd` (de `02-clientes`) contra el saldo pendiente actual del cliente + el nuevo total; si lo excede, advertir (bloqueo duro o soft-warning con confirmación — **decisión a tomar al implementar**, por defecto: soft-warning, el admin puede forzar).

### 4.2 Facturación (`InvoiceService`)
- Numeración secuencial (`facturas.numero`, usar secuencia Postgres o `select max(numero)+1 for update` para evitar duplicados en concurrencia — preferir secuencia real).
- Cálculo: `subtotal_usd = Σ(peso_kg × precio_usd_kg)`, `iva_usd = subtotal_usd × iva_pct/100` (tomar `iva_pct` de `config_negocio`, módulo 03), `total_usd = subtotal_usd + iva_usd`.
- Snapshot de `tasa_snapshot` (tasa del día al emitir) y `costo_usd_kg` por item (tomado del costo promedio vigente del producto, vía `costingService.getStockProducto`) — esto es lo que permite margen real por venta sin recalcular histórico (`/SPEC.md` §4.6).
- Al emitir: descuenta stock llamando `movimientoService.registrarMovimiento('venta', ...)` (de `03-inventario`) por cada item, con `peso_kg` negativo.
- Condición `contado`: factura nace con `pagado_usd = total_usd`. Condición `credito`: nace `abierta`.

### 4.3 Cobros (`/cobros`)
- Lista de facturas abiertas (y opcionalmente cuentas por pagar a proveedores si no quedaron en `03-inventario`, a confirmar con ese módulo).
- Registrar abono: monto, moneda de pago, tasa del día del pago (override manual permitido), método. Calcula `ganancia_cambiaria_bs` con `gananciaCambiariaBs()` (ya existe, reutilizar sin reimplementar).
- Actualiza `facturas.pagado_usd`; si `pagado_usd >= total_usd`, marca `estado = 'pagada'`.
- Muestra saldo pendiente por factura y total por cliente (reutilizable por `02-clientes` para su ficha — exponer `clienteBalanceService.getSaldoPendiente(clienteId)`).

## Patrones (`/SPEC.md` §6)
- **Repository**: `PedidoRepository`, `FacturaRepository`, `PagoRepository`.
- **Strategy**: condición de pago (contado/crédito) ya modelada como un `enum`/union type; si la lógica de cada rama crece, extraer a `PagoContadoStrategy`/`PagoCreditoStrategy` — no es obligatorio desde el día uno, solo si la rama `if/else` se vuelve difícil de leer.
- **Factory**: reutilizar `movimientoService.registrarMovimiento` de `03-inventario` para el movimiento `venta` — no crear una segunda forma de escribir el ledger.

## Fuera de alcance (MVP)
- Facturación fiscal SENIAT (ya excluido en `/SPEC.md` §9).
- Notas de crédito / devoluciones (no mencionado en `/SPEC.md`; si se necesita, es un módulo nuevo, no parte de este).
