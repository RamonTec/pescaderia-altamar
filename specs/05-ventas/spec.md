# 05 — Ventas (Pedidos/POS, facturación, cobros)

## Contexto

Cubre `/SPEC.md` §4.4–4.6: pedidos agendados + venta directa (POS), facturación interna con IVA desglosado, y cobros con ganancia cambiaria. El esquema ya existe (`pedidos`, `pedido_items`, `facturas`, `factura_items`, `pagos`). `creditService.ts` ya tiene `gananciaCambiariaBs`, `usdEquivalentes`, `saldoPendiente`. Falta todo lo demás: repositorios, `InvoiceService`, y las pantallas `/pedidos` y `/cobros` (hoy placeholders).

Depende de `00-estandares-ui`, `02-clientes` (para seleccionar cliente, validar `bloqueado`/`limite_credito_usd`) y `04-inventario` (para descontar stock al vender vía `movimientoService`).

**Actualización de alcance**: el negocio emite notas de crédito sobre facturas ya emitidas (devolución total o parcial, corrección de cantidad/precio). Se agrega como sección 4.4 de este módulo — ya no está fuera de alcance.

## Alcance

### 4.1 Pedidos / POS (`/pedidos`)
- **Pedido agendado**: cliente + fecha de entrega + items (producto, peso estimado, precio_usd_kg pactado). Estado `pendiente`.
- **Venta directa (POS)**: mismo formulario pero sin fecha de entrega futura — se pesa y factura en el mismo paso. Puede ser el mismo formulario con un toggle "entrega inmediata", o una vista separada simplificada — decisión de UI libre siempre que ambos flujos terminen en la misma `InvoiceService.crearFactura(...)`.
- Al **entregar** un pedido pendiente: capturar `peso_entregado_kg` real por item, generar la factura con esos kg (no con el estimado).
- Antes de generar una factura a crédito, verificar primero `clientes.bloqueado` (de `02-clientes`) — si está bloqueado, no se permite venta a crédito (bloqueo duro, sin excepción vía UI; solo un `admin` desbloqueando al cliente desde `02-clientes` habilita de nuevo). Luego verificar `clientes.limite_credito_usd` contra el saldo pendiente actual del cliente + el nuevo total; si lo excede, advertir (soft-warning con confirmación, el admin puede forzar).

### 4.2 Facturación (`InvoiceService`)
- Numeración secuencial (`facturas.numero`, usar secuencia Postgres o `select max(numero)+1 for update` para evitar duplicados en concurrencia — preferir secuencia real).
- Cálculo: `subtotal_usd = Σ(peso_kg × precio_usd_kg)`, `iva_usd = subtotal_usd × iva_pct/100` (tomar `iva_pct` de `config_negocio`, módulo 03), `total_usd = subtotal_usd + iva_usd`.
- Snapshot de `tasa_snapshot` (tasa del día al emitir) y `costo_usd_kg` por item (tomado del costo promedio vigente del producto, vía `costingService.getStockProducto`) — esto es lo que permite margen real por venta sin recalcular histórico (`/SPEC.md` §4.6).
- Al emitir: descuenta stock llamando `movimientoService.registrarMovimiento('venta', ...)` (de `04-inventario`) por cada item, con `peso_kg` negativo.
- Condición `contado`: factura nace con `pagado_usd = total_usd`. Condición `credito`: nace `abierta`.

### 4.3 Cobros (`/cobros`)
- Lista de facturas abiertas (y opcionalmente cuentas por pagar a proveedores si no quedaron en `04-inventario`, a confirmar con ese módulo).
- Registrar abono: monto, moneda de pago, tasa del día del pago (override manual permitido), método. Calcula `ganancia_cambiaria_bs` con `gananciaCambiariaBs()` (ya existe, reutilizar sin reimplementar).
- Actualiza `facturas.pagado_usd`; si `pagado_usd >= total_usd`, marca `estado = 'pagada'`.
- Muestra saldo pendiente por factura y total por cliente (reutilizable por `02-clientes` para su ficha — exponer `clienteBalanceService.getSaldoPendiente(clienteId)`, que debe restar también las notas de crédito emitidas, ver 4.4).

### 4.4 Notas de crédito

- Se emite una nota de crédito **sobre una factura existente** (`factura_id`), nunca de forma independiente. Motivo obligatorio (texto libre: "producto en mal estado", "error de pesaje", "devolución parcial", etc.).
- Puede ser **total** (anula el efecto de la factura completa) o **parcial** (afecta solo algunos items/cantidades). En ambos casos, **la factura original nunca se edita** (`/SPEC.md` principio de "nunca se recalcula historia") — la nota de crédito es un documento nuevo que resta.
- Nueva tabla `public.notas_credito`: `id, factura_id (references facturas), fecha, motivo, subtotal_usd, iva_usd, total_usd, estado (emitida|anulada)`. Nueva tabla `public.nota_credito_items`: `nota_credito_id, factura_item_id (references factura_items), peso_kg, precio_usd_kg` (el peso devuelto, puede ser menor o igual al de la factura original).
- **Efecto en inventario**: si el producto devuelto vuelve a stock vendible (no siempre aplica — ej. pescado ya entregado y consumido no vuelve), se registra un movimiento vía `movimientoService.registrarMovimiento('ajuste', productoId, pesoKg_positivo, costo_usd_kg_del_momento_de_la_venta, notaCreditoId)`. Si el producto no vuelve a stock (devolución por mal estado, se descarta), **no** se registra movimiento de ingreso — solo queda el ajuste contable. Esta decisión (vuelve o no a stock) se captura como un campo `afecta_inventario boolean` en `nota_credito_items`, decidido al emitir la nota.
- **Efecto en saldo del cliente**: `clienteBalanceService.getSaldoPendiente` resta `Σ(notas_credito.total_usd)` en estado `emitida` del total adeudado por ese cliente. Si la factura ya estaba pagada y se emite una nota de crédito, el resultado es un saldo a favor del cliente (puede quedar negativo o gestionarse como crédito para su próxima compra — **MVP: se muestra el saldo a favor, no se automatiza su aplicación a una venta futura**, eso queda como mejora posterior).
- Numeración: igual criterio que `facturas.numero` (secuencia propia, `notas_credito_numero_seq`).

## Patrones (`/SPEC.md` §6)
- **Repository**: `PedidoRepository`, `FacturaRepository`, `PagoRepository`.
- **Strategy**: condición de pago (contado/crédito) ya modelada como un `enum`/union type; si la lógica de cada rama crece, extraer a `PagoContadoStrategy`/`PagoCreditoStrategy` — no es obligatorio desde el día uno, solo si la rama `if/else` se vuelve difícil de leer.
- **Factory**: reutilizar `movimientoService.registrarMovimiento` de `04-inventario` para el movimiento `venta` — no crear una segunda forma de escribir el ledger.

## Fuera de alcance (MVP)
- Facturación fiscal SENIAT (ya excluido en `/SPEC.md` §9).
- Notas de débito (cargos adicionales sobre una factura) — solo se cubren notas de crédito.
- Aplicar automáticamente un saldo a favor (por nota de crédito) a una compra futura del mismo cliente — queda como saldo visible, aplicación manual.
