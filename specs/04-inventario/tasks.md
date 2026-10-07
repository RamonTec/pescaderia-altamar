# Tareas — 04-inventario

Depende de: `00-estandares-ui`, `01-auth` Fase 2 (para ocultar costos a `operador`), `03-proveedores` completo (selección de proveedor y validación de bloqueo en Compras). Puede empezar en paralelo con `02-clientes` (no se tocan los mismos archivos), pero debe estar completo antes de `05-ventas`.

## Catálogo

1. **Migración `0007_config_negocio.sql`**: tabla `public.config_negocio (id int primary key default 1, iva_pct numeric(5,2) not null default 16, fuente_tasa_default text not null default 'bcv' check (fuente_tasa_default in ('bcv','paralela')), umbral_stock_bajo_kg numeric(12,3), constraint single_row check (id = 1))`. Fila única, patrón singleton de configuración. *(Renumerar si `02-clientes`/`03-proveedores` ya ocuparon este número al momento de ejecutar.)*
2. **`src/lib/repositories/configRepository.ts`**: `get()`, `update(data)` sobre `config_negocio`.
3. **`src/app/catalogos/page.tsx`**: tabs o secciones — Productos (DataGrid + form, usa `IProductoRepository` ya existente), Configuración (form de `config_negocio`). **Proveedores ya no va aquí** (ver `03-proveedores`).
4. **Componentes**: `components/organisms/ProductoForm.tsx`, `ProductosTable.tsx`, `ConfigNegocioForm.tsx`.

## Compras

5. **`src/lib/repositories/compraRepository.ts`** (nuevo, implementa interfaz a agregar en `interfaces.ts`: `ICompraRepository` con `create(compra, items)`, `list()`, `getById()`, `registrarPago(compraId, pago)`).
6. **`src/lib/services/movimientoService.ts`** (Factory + escritura del ledger): `registrarMovimiento(tipo, productoId, pesoKg, costoUsdKg, refId)`. Toda escritura a `movimientos` pasa por aquí, nunca inserts sueltos desde otros servicios.
7. **`src/lib/services/compraService.ts`**: orquesta — valida primero `proveedores.bloqueado` (si `condicion === 'credito'`, rechazar), valida items, obtiene tasa del día (`getTasaViva` o manual override), crea `compra` + `compra_items`, llama `movimientoService.registrarMovimiento('compra', ...)` por cada item, marca `pagado_usd` si es `contado`.
8. **Componentes**: `components/organisms/CompraForm.tsx` (selección de proveedor existente de `03-proveedores`, condición, moneda, tasa editable con valor sugerido, tabla de items dinámica; usa `NumberField`/`react-hook-form` de `00-estandares-ui`), `ComprasTable.tsx` (listado con estado).
9. **`src/app/compras/page.tsx`**: `PageHeader` + listado + alta de compra.
10. **Pagos a proveedores**: `lib/services/compraService.registrarPagoProveedor(...)` + UI mínima (puede ser un modal desde `ComprasTable`, no requiere pantalla propia en el MVP) usando `gananciaCambiariaBs` de `creditService.ts` (ya existe, reutilizar).
11. **`src/lib/services/proveedorBalanceService.ts`**: `getSaldoPendiente(proveedorId): Promise<number>` — suma `subtotal_usd - pagado_usd` de compras abiertas del proveedor. Es el servicio que `03-proveedores` debe consumir en la ficha de proveedor (volver a esa tarea pendiente si `03-proveedores` ya se implementó con el placeholder `—`).

> **Notas de ejecución de Compras (2026-10-06, Claude Code):**
> - Migración agregada `0012_compras_registro.sql`: RPC `registrar_compra` (compra + items + movimientos en una sola transacción; supabase-js no tiene transacciones), RPC `registrar_pago_proveedor` (security definer, solo admin; bloquea la fila de la compra para evitar sobrepagos concurrentes) y trigger `compras_guard_proveedor_bloqueado` (repite en la base la regla de crédito con proveedor bloqueado).
> - Tarea 6: `movimientoService.crearMovimiento` es la Factory (el signo del peso lo decide el tipo). La compra no llama a `registrarMovimiento` uno por uno: construye los movimientos con la Factory y los pasa a la RPC transaccional, para que una compra nunca quede sin su movimiento de stock. `registrarMovimiento` queda para movimientos sueltos.
> - Compras con moneda `bs`: el costo/kg se captura en Bs y se guarda en USD (`costo_kg / tasa_snapshot`). Solo se admiten productos `crudo` activos.
> - Compra `contado` (o a crédito con total 0) se crea con `estado = 'pagada'`; así no aparece en el saldo pendiente.
> - Rol: cualquier usuario autenticado registra compras (recepción); importes, saldo y pagos son solo de admin (al operador no le llegan los importes en el payload).
> - Pantalla en `src/app/(protected)/compras/` (la ruta real, no `src/app/compras`).

## Procesamiento

12. **`src/lib/repositories/procesamientoRepository.ts`** (+ interfaz `IProcesamientoRepository`): `create(procesamiento, items)`, `list()`.
13. **`src/lib/services/procesamientoService.ts`**: usa `costoDestino()` de `costingService.ts` (ya existe) para calcular el resultado, crea `procesamientos` + `proceso_items`, llama `movimientoService.registrarMovimiento('proceso_out', ...)` y `('proceso_in', ...)`.
14. **Componentes**: `components/organisms/ProcesamientoForm.tsx` (producto origen + peso entrada, producto destino + peso salida, muestra merma/rendimiento calculados en vivo), `ProcesamientosTable.tsx`.
15. **`src/app/procesamiento/page.tsx`**.

> **Notas de ejecución de Procesamiento (2026-10-06, Claude Code):**
> - Migración agregada `0013_procesamiento_registro.sql`: RPC `registrar_procesamiento` (procesamiento + lote + movimientos `proceso_out`/`proceso_in` en una transacción) y función interna `stock_y_costo_producto` (no expuesta a `authenticated`).
> - Tarea 13, desvío: **el costo transferido lo calcula la RPC**, no el servicio. El operador registra procesamientos y no puede leer costos (`movimientos_view`, 0003), así que el servicio no conoce el costo del crudo con su sesión. La RPC es `security definer`, lee el ledger base, aplica la misma fórmula que `costoDestino()` y no devuelve el costo. `stock_y_costo_producto` replica `acumularMovimientos()` de `costingService.ts`: cambiar uno obliga a cambiar el otro. `costoDestino()` se usa en la UI (merma, rendimiento y, solo admin, costo/kg resultante).
> - Stock: no se puede procesar más kg del que hay (si `controla_stock`). El servicio avisa antes y la RPC lo revalida bajo `pg_advisory_xact_lock('stock:<producto>')`. **`05-ventas` debe tomar el mismo lock** al descontar stock.
> - Un lote por procesamiento en la UI (un crudo → un procesado); el repositorio y la RPC aceptan varios.
> - `costingService`: nuevas `acumularMovimientos()` (función pura compartida) y `getStocks(db)` (stock de todos los productos en una lectura paginada del ledger; sirve también para la tarea 16).
> - Pantalla en `src/app/(protected)/procesamiento/`.
>
> **Ajuste tras revisión con el usuario (2026-10-06):**
> - Peso de entrada: se **precarga con el stock disponible** del crudo elegido (editable, con "Usar todo el stock"). Se descartó procesar por compra/lote: reabriría el costeo por promedio ponderado de `/SPEC.md` §1.
> - Relación crudo → procesado: migración `0014_producto_origen.sql` agrega `productos.producto_origen_id` (un procesado sale de un solo crudo; un crudo puede tener varios procesados). Check `productos_origen_segun_tipo` (`not valid`: los procesados existentes sin asignar se completan en Catálogos), trigger `productos_guard_origen` y `registrar_procesamiento` reemplazada para rechazar un destino que no corresponda al origen. Catálogos pide "Se obtiene de" al crear/editar un procesado; Procesamiento solo ofrece los procesados del crudo elegido.

## Inventario / stock

16. **`src/app/inventario/page.tsx`**: conecta `getInventarioValorizado()` (ya existe en `costingService.ts`) a una tabla; obtiene `bsPorUsd` vigente con `getTasaViva()`.
17. **Ocultar columnas de costo/valor para `operador`**: usar `authService.getRol()` (de `01-auth`) en el Server Component de esta página para decidir qué columnas pasar al componente de tabla.
18. **Alertas de stock bajo**: comparar `stock_kg` contra `config_negocio.umbral_stock_bajo_kg`; resaltar fila o badge en la tabla.
19. **Historial de movimientos por producto**: sub-vista o modal desde la tabla de inventario, lista `movimientos` filtrado por `producto_id`, ordenado por fecha desc.

## Verificación de cálculo (no saltarse)

20. Prueba manual: registrar una compra de 10kg a $2/kg de un producto crudo con stock 0 → stock debe quedar en 10kg a $2/kg exacto.
21. Prueba manual: procesar esos 10kg crudos → 7kg procesados → el procesado debe quedar a `(10×2)/7 = $2.857142.../kg` y el crudo debe bajar a 0kg.
22. Prueba manual: segunda compra de 5kg a $3/kg del mismo crudo cuando ya había 10kg a $2/kg (antes de procesar) → costo ponderado esperado `(10×2 + 5×3)/15 = $2.333.../kg`.

## Tarea agregada por otro módulo
- **07-lotes (2026-10-07)**: el costeo pasa de promedio ponderado a **costo por lote** (decisión reabierta por el usuario; ver `07-lotes/spec.md`). Cambia el esquema de este módulo: `lotes`, `movimientos.lote_id`, tipo `perdida`, `proceso_items.lote_origen_id`, `config_negocio.dias_alerta_lote`, y se reemplazan las RPC `registrar_compra` y `registrar_procesamiento` (migraciones `20261007180000`–`20261007180400` de `07-lotes`; los nombres `0018`–`0022` eran provisionales). Esto anula la nota del 2026-10-06 que descartaba procesar por lote.
- **Tareas 16–19 (pantalla `/inventario`) absorbidas por `07-lotes`** (tareas 18–20 de ese módulo): se construyen directamente con lotes, no sobre el promedio ponderado.
- **Tarea 22 (costo ponderado tras una segunda compra) queda obsoleta**: la reemplaza la tarea 23 de `07-lotes` (dos lotes con su propio costo).
- **08-tasas (2026-10-07)**: `tasas` cambia (`bs_por_usd` → `valor_bs`, + `moneda`/`origen`; RLS de escritura solo admin). `compras` y `pagos_proveedores` suman `tasa_origen`, `tasa_fuente`, `tasa_referencial` y `tasa_registrada_por`, y se actualizan `registrar_compra`/`registrar_pago_proveedor`. `config_negocio` suma `umbral_desviacion_tasa_pct`. `getTasaSugerida` se reemplaza por `getTasaVigente`, y `CompraForm`/`PagoProveedorDialog` usan `TasaSelector`.
- **06-contratos (2026-10-07)**: cambios en el esquema y la UI de este módulo:
  - `config_negocio` suma `razon_social`, `rif`, `direccion` y `telefono` (migración `20261007190000_config_negocio_datos_contrato.sql`), editables en `ConfigNegocioForm` y validados en `configFormSchema`. Son datos del encabezado del PDF.
  - `ComprasTable` recibe `accionesExtra` para las opciones de contrato en su menú `⋮` (solo admin).
  - Las RLS de `config_negocio` no cambian.
