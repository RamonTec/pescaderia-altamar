# Tareas — 05-ventas

Depende de: `00-estandares-ui`, `02-clientes` completo, `04-inventario` completo (necesita `movimientoService` y `getStockProducto`/`getInventarioValorizado`).

## Preparación de esquema

1. **Migración `0007_facturas_secuencia.sql`**: `create sequence if not exists public.facturas_numero_seq;` y ajustar `facturas.numero` para usar `nextval('facturas_numero_seq')` como default, evitando colisiones (hoy `numero` no tiene default, es responsabilidad del código — mover a la BD es más seguro). *(Renumerar si `02-clientes`/`04-inventario` ya ocuparon este número al momento de ejecutar.)*
2. **Migración `0008_notas_credito.sql`**: tabla `public.notas_credito` y `public.nota_credito_items` según el spec, más `create sequence if not exists public.notas_credito_numero_seq;`.

> **Nota de renumeración (2026-10-06)**: al ejecutar, `04-inventario` (procesamiento) ya ocupó `0013`. Este módulo usó **`0015_facturas_secuencia.sql`** (tarea 1) y **`0016_notas_credito_y_rpc_ventas.sql`** (tarea 2, que además incluye las RPC transaccionales `registrar_pedido`, `registrar_factura`, `registrar_pago`, `registrar_nota_credito` y `anular_nota_credito`).

## Repositorios

3. **`src/lib/repositories/pedidoRepository.ts`** (+ `IPedidoRepository` en `interfaces.ts`): `create(pedido, items)`, `list(filtro_estado?)`, `getById`, `marcarEntregado(id, pesosReales)`.
4. **`src/lib/repositories/facturaRepository.ts`** (+ `IFacturaRepository`): `create(factura, items)`, `list(filtro_estado?)`, `getById`, `getByCliente(clienteId)`.
5. **`src/lib/repositories/pagoRepository.ts`** (+ `IPagoRepository`): `create(pago)`, `listByFactura(facturaId)`.
6. **`src/lib/repositories/notaCreditoRepository.ts`** (+ `INotaCreditoRepository`): `create(notaCredito, items)`, `list(filtro_estado?)`, `getById`, `listByFactura(facturaId)`.

## Servicios

7. **`src/lib/services/invoiceService.ts`**: `crearFactura({clienteId, pedidoId?, items, condicion, moneda})` — orquesta: valida primero `clientes.bloqueado` (si `condicion === 'credito'`, rechazar duro), obtiene `iva_pct` de `config_negocio` (04-inventario), obtiene tasa vigente, obtiene costo promedio por producto (`costingService.getStockProducto`), calcula subtotal/iva/total, crea factura + items, llama `movimientoService.registrarMovimiento('venta', ..., pesoKg negativo)` por item, marca `pagado_usd` si contado.
8. **`src/lib/services/pedidoService.ts`**: `crearPedido(...)`, `entregarPedido(pedidoId, pesosReales)` → al entregar, llama `invoiceService.crearFactura` con los pesos reales y marca `pedidos.estado = 'facturado'`.
9. **`src/lib/services/pagoService.ts`**: `registrarPago(facturaId, {monto, moneda, tasa, metodo})` → usa `gananciaCambiariaBs` y `usdEquivalentes` de `creditService.ts` (ya existen, no reimplementar), actualiza `facturas.pagado_usd`, marca `pagada` si corresponde.
10. **`src/lib/services/notaCreditoService.ts`**: `emitirNotaCredito({facturaId, items, motivo})` — valida que `peso_kg` de cada item no exceda el de la `factura_item` original menos lo ya devuelto en notas previas, calcula `subtotal/iva/total` proporcional, crea `notas_credito` + `nota_credito_items`, y para cada item con `afecta_inventario = true` llama `movimientoService.registrarMovimiento('ajuste', ..., pesoKg positivo, costo_usd_kg_de_la_factura_original, notaCreditoId)`.
11. **`src/lib/services/clienteBalanceService.ts`**: `getSaldoPendiente(clienteId): Promise<number>` — suma `total_usd - pagado_usd` de facturas abiertas del cliente, **menos** `Σ(notas_credito.total_usd)` en estado `emitida` asociadas a esas facturas. Este es el servicio que `02-clientes` debe consumir en la ficha de cliente (volver a esa tarea pendiente si `02-clientes` ya se implementó con el placeholder `—`).
12. **Validación de límite de crédito**: en `pedidoService`/`invoiceService`, antes de crear una venta a crédito, comparar `clienteBalanceService.getSaldoPendiente(clienteId) + nuevoTotal` contra `clientes.limite_credito_usd`; si lo excede, retornar advertencia estructurada (no solo un throw genérico) para que la UI decida pedir confirmación.

## UI

13. **Componentes**: `components/organisms/PedidoForm.tsx` (cliente, fecha entrega opcional, tabla de items dinámica con producto/peso estimado/precio; usa `NumberField`/`react-hook-form` de `00-estandares-ui`), `PedidosTable.tsx` (estado, acciones "entregar"/"anular"), `EntregaPedidoDialog.tsx` (captura peso real por item).
14. **`src/app/pedidos/page.tsx`**: `PageHeader` + listado + alta (pedido agendado o venta directa) + acción de entrega.
15. **Componentes de cobros**: `components/organisms/FacturasAbiertasTable.tsx`, `RegistrarPagoDialog.tsx` (monto, moneda, tasa con valor sugerido editable, método, muestra ganancia/pérdida cambiaria calculada en vivo antes de confirmar).
16. **`src/app/cobros/page.tsx`**: listado de facturas abiertas + acción registrar pago.
17. **Componentes de notas de crédito**: `components/organisms/NotaCreditoForm.tsx` (selecciona factura, items con peso a devolver ≤ lo facturado, toggle `afecta_inventario` por item, motivo obligatorio), `NotasCreditoTable.tsx`. Accesible desde la ficha de la factura ("emitir nota de crédito") y desde una pantalla propia `/notas-credito` (listado general).
18. **`src/app/notas-credito/page.tsx`** + agregar ítem a `AppShell.tsx`.
19. **Estados de carga/vacío/confirmaciones/notificaciones**: todas las pantallas de este módulo usan los componentes de `00-estandares-ui` (`PageLoader`, `EmptyState`, `ErrorState`, `ConfirmDialog` para anular pedido/factura, `useNotify` tras cada acción) — no se improvisa un patrón nuevo.
20. **Volver a `02-clientes`**: conectar `clienteBalanceService.getSaldoPendiente` en la ficha de cliente (reemplazar el `—` placeholder).

## Verificación de cálculo (no saltarse)

21. Prueba manual: factura de 5kg a $4/kg con IVA 16% → subtotal $20, IVA $3.20, total $23.20.
22. Prueba manual: factura a crédito de $23.20, abono de $10 en Bs cuando la tasa de factura era 36.5 y la tasa de pago es 39.2 → ganancia cambiaria esperada `(39.2-36.5) × 10 = 27 Bs`; saldo pendiente baja a $13.20.
23. Prueba manual: nota de crédito parcial de 2kg sobre una factura de 5kg a $4/kg (sin IVA para simplificar) → nota de $8, saldo pendiente del cliente baja $8; si `afecta_inventario = true`, el stock del producto sube 2kg al costo que tenía al momento de la venta original (no el costo actual si cambió).

## Tarea agregada por otro módulo
- **07-lotes (2026-10-07)**: cada línea vendida se asigna a lotes (PEPS, editable) en POS y en la entrega de pedido. `registrar_factura` pasa a `security definer`, valida stock por lote bajo lock y calcula el costo desde los lotes (tabla nueva `factura_item_lotes`). `registrar_nota_credito`/`anular_nota_credito` devuelven o revierten por lote. Migración `20261007180400_lotes_rpc_ventas.sql` de `07-lotes` (antes nombrada provisionalmente `0021`).
- **Hallazgos corregidos allí**: (1) el costo snapshot de la factura queda en 0 o nulo cuando vende un operador (`invoiceService` lee `movimientos_view`, que le oculta el costo); (2) `registrar_factura` no valida stock ni toma el lock que pedía `0013`, así que se puede vender más de lo que hay. La tarea 23 de este archivo se vuelve a verificar con lotes (tarea 27 de `07-lotes`).
- **08-tasas (2026-10-07)**: `facturas` y `pagos` suman `tasa_origen`, `tasa_fuente`, `tasa_referencial` y `tasa_registrada_por`, y se actualizan `registrar_factura`/`registrar_pago`. La venta (POS y entrega) permite elegir la tasa referencial o una manual (`TasaSelector`) en lugar de leer siempre la del día. **Hallazgo corregido allí**: hoy el POS falla con "No hay tasa registrada hoy" si nadie cargó la tasa por SQL (no existe pantalla para hacerlo), y también los fines de semana.
- **09-cuentas-por-cobrar (2026-10-07)**: `facturas.fecha_vencimiento` (con backfill) y `registrar_factura` la recibe; POS y entrega a crédito muestran "Vence el" editable. `/cobros` reemplaza `FacturasAbiertasTable` por `DocumentosCarteraTable` (estado, filtro de vencidas, "Recordar"). `config_negocio` suma días de crédito, aviso por vencer, nombre comercial e instrucciones de pago.
