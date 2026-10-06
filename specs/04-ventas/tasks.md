# Tareas — 04-ventas

Depende de: `02-clientes` completo, `03-inventario` completo (necesita `movimientoService` y `getStockProducto`/`getInventarioValorizado`).

## Preparación de esquema

1. **Migración `0006_facturas_secuencia.sql`**: `create sequence if not exists public.facturas_numero_seq;` y ajustar `facturas.numero` para usar `nextval('facturas_numero_seq')` como default, evitando colisiones (hoy `numero` no tiene default, es responsabilidad del código — mover a la BD es más seguro).

## Repositorios

2. **`src/lib/repositories/pedidoRepository.ts`** (+ `IPedidoRepository` en `interfaces.ts`): `create(pedido, items)`, `list(filtro_estado?)`, `getById`, `marcarEntregado(id, pesosReales)`.
3. **`src/lib/repositories/facturaRepository.ts`** (+ `IFacturaRepository`): `create(factura, items)`, `list(filtro_estado?)`, `getById`, `getByCliente(clienteId)`.
4. **`src/lib/repositories/pagoRepository.ts`** (+ `IPagoRepository`): `create(pago)`, `listByFactura(facturaId)`.

## Servicios

5. **`src/lib/services/invoiceService.ts`**: `crearFactura({clienteId, pedidoId?, items, condicion, moneda})` — orquesta: obtiene `iva_pct` de `config_negocio` (03-inventario), obtiene tasa vigente, obtiene costo promedio por producto (`costingService.getStockProducto`), calcula subtotal/iva/total, crea factura + items, llama `movimientoService.registrarMovimiento('venta', ..., pesoKg negativo)` por item, marca `pagado_usd` si contado.
6. **`src/lib/services/pedidoService.ts`**: `crearPedido(...)`, `entregarPedido(pedidoId, pesosReales)` → al entregar, llama `invoiceService.crearFactura` con los pesos reales y marca `pedidos.estado = 'facturado'`.
7. **`src/lib/services/pagoService.ts`**: `registrarPago(facturaId, {monto, moneda, tasa, metodo})` → usa `gananciaCambiariaBs` y `usdEquivalentes` de `creditService.ts` (ya existen, no reimplementar), actualiza `facturas.pagado_usd`, marca `pagada` si corresponde.
8. **`src/lib/services/clienteBalanceService.ts`**: `getSaldoPendiente(clienteId): Promise<number>` — suma `total_usd - pagado_usd` de facturas abiertas del cliente. Este es el servicio que `02-clientes` debe consumir en la ficha de cliente (volver a esa tarea pendiente si `02-clientes` ya se implementó con el placeholder `—`).
9. **Validación de límite de crédito**: en `pedidoService`/`invoiceService`, antes de crear una venta a crédito, comparar `clienteBalanceService.getSaldoPendiente(clienteId) + nuevoTotal` contra `clientes.limite_credito_usd`; si lo excede, retornar advertencia estructurada (no solo un throw genérico) para que la UI decida bloquear o pedir confirmación.

## UI

10. **Componentes**: `components/organisms/PedidoForm.tsx` (cliente, fecha entrega opcional, tabla de items dinámica con producto/peso estimado/precio), `PedidosTable.tsx` (estado, acciones "entregar"/"anular"), `EntregaPedidoDialog.tsx` (captura peso real por item).
11. **`src/app/pedidos/page.tsx`**: listado + alta (pedido agendado o venta directa) + acción de entrega.
12. **Componentes de cobros**: `components/organisms/FacturasAbiertasTable.tsx`, `RegistrarPagoDialog.tsx` (monto, moneda, tasa con valor sugerido editable, método, muestra ganancia/pérdida cambiaria calculada en vivo antes de confirmar).
13. **`src/app/cobros/page.tsx`**: listado de facturas abiertas + acción registrar pago.
14. **Volver a `02-clientes`**: conectar `clienteBalanceService.getSaldoPendiente` en la ficha de cliente (reemplazar el `—` placeholder).

## Verificación de cálculo (no saltarse)

15. Prueba manual: factura de 5kg a $4/kg con IVA 16% → subtotal $20, IVA $3.20, total $23.20.
16. Prueba manual: factura a crédito de $23.20, abono de $10 en Bs cuando la tasa de factura era 36.5 y la tasa de pago es 39.2 → ganancia cambiaria esperada `(39.2-36.5) × 10 = 27 Bs`; saldo pendiente baja a $13.20.
