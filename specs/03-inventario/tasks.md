# Tareas — 03-inventario

Depende de: `01-auth` Fase 2 (para ocultar costos a `operador`). Puede empezar en paralelo con `02-clientes` (no se tocan los mismos archivos), pero debe estar completo antes de `04-ventas`.

## Catálogo

1. **Migración `0005_config_negocio.sql`**: tabla `public.config_negocio (id int primary key default 1, iva_pct numeric(5,2) not null default 16, fuente_tasa_default text not null default 'bcv' check (fuente_tasa_default in ('bcv','paralela')), umbral_stock_bajo_kg numeric(12,3), constraint single_row check (id = 1))`. Fila única, patrón singleton de configuración.
2. **`src/lib/repositories/configRepository.ts`**: `get()`, `update(data)` sobre `config_negocio`.
3. **`src/app/catalogos/page.tsx`**: tabs o secciones — Productos (DataGrid + form, usa `IProductoRepository` ya existente), Proveedores (idem con `IProveedorRepository`), Configuración (form de `config_negocio`).
4. **Componentes**: `components/organisms/ProductoForm.tsx`, `ProductosTable.tsx`, `ProveedorForm.tsx`, `ProveedoresTable.tsx`, `ConfigNegocioForm.tsx`.

## Compras

5. **`src/lib/repositories/compraRepository.ts`** (nuevo, implementa interfaz a agregar en `interfaces.ts`: `ICompraRepository` con `create(compra, items)`, `list()`, `getById()`, `registrarPago(compraId, pago)`).
6. **`src/lib/services/movimientoService.ts`** (Factory + escritura del ledger): `registrarMovimiento(tipo, productoId, pesoKg, costoUsdKg, refId)`. Toda escritura a `movimientos` pasa por aquí, nunca inserts sueltos desde otros servicios.
7. **`src/lib/services/compraService.ts`**: orquesta — valida items, obtiene tasa del día (`getTasaViva` o manual override), crea `compra` + `compra_items`, llama `movimientoService.registrarMovimiento('compra', ...)` por cada item, marca `pagado_usd` si es `contado`.
8. **Componentes**: `components/organisms/CompraForm.tsx` (selección proveedor, condición, moneda, tasa editable con valor sugerido, tabla de items dinámica), `ComprasTable.tsx` (listado con estado).
9. **`src/app/compras/page.tsx`**: listado + alta de compra.
10. **Pagos a proveedores**: `lib/services/compraService.registrarPagoProveedor(...)` + UI mínima (puede ser un modal desde `ComprasTable`, no requiere pantalla propia en el MVP) usando `gananciaCambiariaBs` de `creditService.ts` (ya existe, reutilizar).

## Procesamiento

11. **`src/lib/repositories/procesamientoRepository.ts`** (+ interfaz `IProcesamientoRepository`): `create(procesamiento, items)`, `list()`.
12. **`src/lib/services/procesamientoService.ts`**: usa `costoDestino()` de `costingService.ts` (ya existe) para calcular el resultado, crea `procesamientos` + `proceso_items`, llama `movimientoService.registrarMovimiento('proceso_out', ...)` y `('proceso_in', ...)`.
13. **Componentes**: `components/organisms/ProcesamientoForm.tsx` (producto origen + peso entrada, producto destino + peso salida, muestra merma/rendimiento calculados en vivo), `ProcesamientosTable.tsx`.
14. **`src/app/procesamiento/page.tsx`**.

## Inventario / stock

15. **`src/app/inventario/page.tsx`**: conecta `getInventarioValorizado()` (ya existe en `costingService.ts`) a una tabla; obtiene `bsPorUsd` vigente con `getTasaViva()`.
16. **Ocultar columnas de costo/valor para `operador`**: usar `authService.getRol()` (de `01-auth`) en el Server Component de esta página para decidir qué columnas pasar al componente de tabla.
17. **Alertas de stock bajo**: comparar `stock_kg` contra `config_negocio.umbral_stock_bajo_kg`; resaltar fila o badge en la tabla.
18. **Historial de movimientos por producto**: sub-vista o modal desde la tabla de inventario, lista `movimientos` filtrado por `producto_id`, ordenado por fecha desc.

## Verificación de cálculo (no saltarse)

19. Prueba manual: registrar una compra de 10kg a $2/kg de un producto crudo con stock 0 → stock debe quedar en 10kg a $2/kg exacto.
20. Prueba manual: procesar esos 10kg crudos → 7kg procesados → el procesado debe quedar a `(10×2)/7 = $2.857142.../kg` y el crudo debe bajar a 0kg.
21. Prueba manual: segunda compra de 5kg a $3/kg del mismo crudo cuando ya había 10kg a $2/kg (antes de procesar) → costo ponderado esperado `(10×2 + 5×3)/15 = $2.333.../kg`.
