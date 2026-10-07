# Tareas — 07-lotes

Depende de: `04-inventario` (compras y procesamiento) y `05-ventas` (facturación y notas de crédito), ambos implementados. Absorbe las tareas 16–19 de `04-inventario` (pantalla `/inventario`). No depende de `06-contratos` ni lo bloquea; se recomienda ejecutarlo **antes** de `06` porque corrige dos fallas de `05-ventas` (ver "Hallazgos" en `spec.md`).

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`. Las migraciones existentes no se editan: todo va en migraciones nuevas desde el **primer número libre**. Los nombres `0018`–`0022` de este archivo son provisionales: si `08-tasas` se ejecuta antes, como se recomienda, ocupa `0018`–`0019` y estas se corren.

**Si `08-tasas` ya está hecho**: las RPC que se reescriben aquí (`registrar_compra`, `registrar_factura`) deben **conservar** las columnas `tasa_origen`, `tasa_fuente`, `tasa_referencial` y `tasa_registrada_por` y seguir usando `resolverTasaOperacion` en los servicios.

## Fase A — Esquema

1. **`0018_lotes.sql`**: tabla `lotes` (con checks de origen ↔ FK), índices `(producto_id, estado, fecha_ingreso)` y `(lote_padre_id)`; `movimientos.lote_id` + índice + check `not valid`; ampliar el check de `movimientos.tipo` con `perdida`; `proceso_items.lote_origen_id`; tablas `factura_item_lotes` y `perdidas_lote`; `config_negocio.dias_alerta_lote`. RLS de lectura para `authenticated`; **sin** políticas de insert/update directas en `lotes`, `factura_item_lotes` ni `perdidas_lote` (solo vía RPC).
2. **`0019_lotes_vistas.sql`**: vista `lotes_stock` (stock por lote desde `movimientos`); `lotes_view` y `factura_item_lotes_view` con el costo anulado si `not es_admin()` (patrón de `0003`); `revoke select` de las tablas base. Función interna `generar_codigo_lote(producto_id, fecha)`.
3. **`0020_lotes_rpc_inventario.sql`**: reemplazar `registrar_compra` (crea lote por item, devuelve `{ compra_id, lotes: [{ codigo, producto_id, peso_kg }] }`) y `registrar_procesamiento` (exige `lote_origen_id`, lock de la fila del lote, crea el lote destino, marca `agotado`). Nuevas `registrar_perdida` y `cerrar_lote`. Retirar `stock_y_costo_producto` cuando ya no la use nada.
4. **`0021_lotes_rpc_ventas.sql`**: `sugerir_lotes(producto_id, peso_kg)` (lectura, sin costos); reemplazar `registrar_factura` → `security definer` con `auth.uid()` obligatorio, acepta la asignación por item o la calcula con PEPS, valida stock bajo lock, calcula el costo desde los lotes y escribe `factura_item_lotes` + movimientos `venta` con `lote_id`. Reemplazar `registrar_nota_credito` / `anular_nota_credito` para devolver o revertir por lote. Mantener las validaciones actuales (cliente bloqueado, items no vacíos, secuencia de número).
5. **`0022_lotes_reinicio_datos_prueba.sql`**: la base solo tiene datos de prueba (confirmado el 2026-10-07): vaciar los datos transaccionales y reiniciar la secuencia de facturas, según la sección "Arranque de datos" de `spec.md`. **Esta migración va antes que las de esquema de la tarea 1**, para que los checks de lote se creen validados (reordenar los números al ejecutar). **Confirmar de nuevo con el usuario justo antes de aplicarla** (borrado irreversible).
6. **`src/types/domain.ts`**: `Lote`, `EstadoLote`, `OrigenLote`, `FacturaItemLote`, `PerdidaLote`, `MotivoPerdida`, `AsignacionLote { lote_id; codigo; peso_kg; disponible_kg; fecha_ingreso }`, `TrazabilidadLote`; `TipoMovimiento` + `perdida`; `lote_id` en `Movimiento`.

## Fase B — Repositorios y servicios

7. **`interfaces.ts` + `repositories/loteRepository.ts`**: `listAbiertos(productoId)`, `list(filtros)`, `getById`, `getArbol(loteId)` (lote + descendientes), `sugerir(productoId, pesoKg)` → RPC, `registrarPerdida`, `cerrar`. Lecturas siempre desde `lotes_view` / `lotes_stock`.
8. **`services/loteService.ts`**: validaciones previas (kg > 0, motivo obligatorio, kg ≤ disponible), `diasEnCava(lote)`, `esAntiguo(lote, config)` y el cálculo **puro** `resultadoLote(arbol)` → `{ ingresoUsd, costoVendidoUsd, costoPerdidoUsd, resultadoUsd, resultadoBs, efectoCambiarioBs, mermaKg, rendimiento }` según las fórmulas de `spec.md`.
9. **`costingService.ts`**: reemplazar el promedio ponderado por la valorización por lote (`getInventarioPorLotes(bsPorUsd)`: stock, valor y costo promedio informativo por producto). Quitar `costoPonderado` / `acumularMovimientos` / `getStockProducto` cuando no tengan consumidores; `costoDestino()` se queda (la UI la usa para merma y rendimiento).
10. **`compraService` / `procesamientoService`**: adaptar a las nuevas firmas de las RPC (devolver los códigos de lote; `lote_origen_id` obligatorio en el esquema zod de procesamiento, y el peso de entrada se valida contra el stock **del lote**).
11. **`invoiceService` / `pedidoService`**: dejar de leer el costo (**corrige el hallazgo 1**); aceptar `asignaciones?: AsignacionLote[]` por item, con validación zod `Σ peso = peso del item`; mapear errores de la RPC (`stock_insuficiente`, `lote_no_disponible`, `asignacion_no_cuadra`) a `fieldErrors` del item.
12. **`notaCreditoService`**: sin cambio de firma; verificar que la devolución vaya a los lotes de origen.

## Fase C — UI

13. **`molecules/LoteChip.tsx`** (código + kg + chip "antiguo") y **`molecules/LoteAutocomplete.tsx`** (opciones con código, fecha, días, proveedor y kg disponibles; preselecciona el más antiguo). Registrarlos en la tabla de componentes de `00-estandares-ui/spec.md`.
14. **`organisms/LotesCreadosDialog.tsx`** + **`CompraForm` / `ComprasTable`**: mostrar los códigos al guardar (copiar con `CopyableText`) y en el listado.
15. **`ProcesamientoForm`**: `LoteAutocomplete` después del crudo, "Usar todo el lote", y al guardar el código del lote procesado. El peso de entrada se valida contra el stock del lote.
16. **`organisms/AsignacionLotesDialog.tsx`** + **`PedidoItemsFieldArray` / POS / `EntregaPedidoDialog`**: al cambiar producto o peso, pedir `sugerir_lotes` (con debounce, `Skeleton` pequeño mientras llega) y mostrar los `LoteChip` de la línea. "Cambiar lotes" abre el diálogo de asignación (aviso en vivo si no cuadra o excede). Error de stock insuficiente en la línea.
17. **`organisms/PerdidaLoteDialog.tsx`** (kg, motivo, detalle; zod) y **cerrar lote** con `ConfirmDialog` que muestra los kg que se dan de baja.
18. **`/inventario`** (`page.tsx` server: rol + datos; `inventario-screen.tsx`; `loading.tsx` con skeleton de tabla; `error.tsx`): pestañas **Productos** (filas que se expanden con `Collapse`, costo y valor solo admin, stock bajo) y **Lotes** (DataGrid, barra de % restante, filtros, búsqueda por código, menú de acciones). Columnas secundarias ocultas en `xs`.
19. **`/inventario/lotes/[id]`** (`page.tsx`, `lote-ficha.tsx`, `loading.tsx`, `not-found.tsx`): encabezado con código copiable, línea de tiempo, árbol padre/hijos con enlaces, tarjeta de resultado (solo admin, `formatUsd`/`formatBs`). `Fade` de skeleton a contenido.
20. **`ConfigNegocioForm`**: campo "Días para marcar un lote como antiguo" (opcional).

## Fase D — Verificación (no saltarse)

21. `npm run lint`, `npx tsc --noEmit`, `npm run build`.
22. Aplicar las migraciones en Supabase (en orden, previa confirmación del borrado) y comprobar que clientes, proveedores, productos, tasas y configuración siguen intactos y que el inventario queda en 0.
23. **Caso del cliente**: lunes compra 30 kg de salmón a $10/kg (tasa 40) → lote A; martes 30 kg a $11/kg (tasa 42) → lote B. Inventario: 60 kg, valor $630, dos lotes.
24. Procesar 20 kg **del lote B** → 15 kg de filete: lote B queda en 10 kg; nace el lote de filete B1 a `220 / 15 = $14.666667/kg`; el lote A no cambia.
25. Vender 35 kg de salmón entero con PEPS: se asignan 30 kg de A (agotado) y 5 kg de B; `factura_items.costo_usd_kg = (30×10 + 5×11) / 35`. Vender otra vez cambiando la asignación a mano y comprobar que respeta la elección.
26. Registrar una pérdida de 1 kg en B1 (dañado); cerrar el lote B con el remanente; ver ambos en la trazabilidad.
27. Nota de crédito con `afecta_inventario` sobre la venta del paso 25: el lote B vuelve a recibir los kg y A se reabre si corresponde; anularla revierte exactamente eso.
28. Trazabilidad del lote B (admin): compra, procesamiento (merma 5 kg = 25%), venta, pérdida, cierre, y resultado USD/Bs/efecto cambiario que coincide con un cálculo a mano.
29. Sesión de **operador**: vende y el costo de la factura es correcto (hallazgo 1); no ve costos en `/inventario` ni en la ficha de lote (ni por PostgREST directo); no puede vender más de lo que hay (hallazgo 2).
30. Concurrencia: dos ventas simultáneas sobre el último kg del mismo lote → una falla con "stock insuficiente", ninguna deja el lote en negativo.
31. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "06-contratos necesita … — agregado el <fecha>")_
- **09-cuentas-por-cobrar (2026-10-07)**: agrega `facturas.fecha_vencimiento` y la pasa en `registrar_factura`. Si este módulo reescribe esa RPC después, **conservar** la columna.
- **09-cuentas-por-cobrar, ejecutado (2026-10-07)**: la migración `20261007170000_cartera_vencimientos.sql` reescribe `registrar_factura` (versión de 0019 + `dias_credito` en el insert; contado = 0). `fecha_vencimiento` la deriva el trigger `facturas_derivar_vencimiento` (no hace falta pasarla). **Ojo con la numeración**: las migraciones de 09 usan prefijo de timestamp (`20261007170000…`); una migración nueva de este módulo con prefijo `0021_…` se ordenaría **antes** y la de 09 pisaría su `registrar_factura`. Usar un prefijo posterior (timestamp ≥ `20261007170300`) y conservar `dias_credito`.
