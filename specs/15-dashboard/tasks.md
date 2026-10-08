# Tareas — 15-dashboard

Ejecutar en orden. Cada tarea indica archivos y criterio de hecho.

Depende de: `04-inventario`, `05-ventas`, `06-contratos`, `07-lotes`, `08-tasas` y `09-cuentas-por-cobrar` (todos implementados). Usa los componentes de `00-estandares-ui` Fase 2.

Decisiones D1–D7 **cerradas por el usuario el 2026-10-08** (ver "Decisiones cerradas" en `spec.md`): `@mui/x-charts`; vencimiento de CxP derivado (contrato `compra_credito` activo o `compras.fecha + dias_credito_default`) sin cambiar el esquema de `compras`; rangos de antigüedad fijos 0–2 / 3–5 / > 5; ventas netas de notas de crédito y sin IVA; neto cambiario = cobros − pagos a proveedores; ventas por mes = 12 meses hasta `hasta`; exposición = brecha BCV/paralela + resultado latente. Ningún otro módulo cambia de esquema.

Numeración de migraciones: prefijo timestamp, primer libre al ejecutar (≥ `20261008000000`, después de `20261007190100_contratos.sql`). Nunca editar migraciones aplicadas.

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`.

## Fase A — Esquema (solo funciones, vista auxiliar e índices; sin tablas nuevas)

1. **`NNNN_dashboard_base.sql`**: vista `dashboard_facturas_saldo_view` (saldo por factura no anulada con notas de crédito emitidas, `fecha_vencimiento`, `dias_vencida` con hoy `America/Caracas`), comentario cruzado a `src/lib/cartera/estado.ts`; `revoke select … from authenticated, anon` (solo la leen las funciones). Función interna `dashboard_hoy()` → `date`. Índices `create index if not exists` de la sección "Rendimiento" de `spec.md` que justifique `explain`.
   - Hecho: la vista da el mismo saldo por cliente que `cartera_clientes_view.saldo_usd` (consulta de comparación en el comentario).
2. **`NNNN_dashboard_operativo.sql`**: `dashboard_operativo()` (pedidos `pendiente` hoy/mañana/atrasados con kg estimados; productos bajo `umbral_stock_bajo_kg`; lotes abiertos con días > `dias_alerta_lote`; USD estimado de pedidos `null` si `not es_admin()`) y `dashboard_antiguedad_lotes()` (tramos fijos 0–2 / 3–5 / > 5 días, kg, n.º de lotes, USD `null` si no admin). `grant execute` a `authenticated`.
   - Hecho: con sesión de operador devuelven kg y conteos, ningún importe ni costo.
3. **`NNNN_dashboard_ventas.sql`** (todas exigen `es_admin()`, error `42501` si no): `dashboard_kpis_dia()` (ventas, kg, n.º y margen del día; CxC total/vencido/clientes con vencidas; CxP; valor inventario USD), `dashboard_ventas_mensuales(p_desde, p_hasta)`, `dashboard_productos_salida(p_desde, p_hasta)`, `dashboard_spread_precio_costo(p_desde, p_hasta, p_producto_id)`, `dashboard_mezcla_ventas(p_desde, p_hasta)` (condición, métodos, ticket), `dashboard_top_clientes(p_desde, p_hasta, p_limite)`, `dashboard_clientes_inactivos(p_dias)`, `dashboard_resultado_cambiario(p_desde, p_hasta)`. Ventas, kg y margen netos de notas de crédito emitidas (por fecha de la nota) y sin IVA (D4); `dashboard_ventas_mensuales` devuelve los 12 meses que terminan en el mes de `p_hasta` (D6); `dashboard_resultado_cambiario` devuelve cobros, pagos a proveedores y neto = cobros − pagos (D5).
   - Hecho: con un operador, toda llamada falla con `42501`; con admin, el margen de una factura de prueba cuadra con `factura_item_lotes` (Σ `peso × costo`).
4. **`NNNN_dashboard_inventario.sql`** (admin): `dashboard_merma_procesos(p_desde, p_hasta)`, `dashboard_rendimiento_proveedor(p_desde, p_hasta)` (vía `proceso_items.lote_origen_id → lotes.proveedor_id`), `dashboard_perdidas_motivo(p_desde, p_hasta)`, `dashboard_valor_inventario()` (por producto, desde `lotes`/ledger).
   - Hecho: un procesamiento de 20 kg → 14 kg da merma 6 kg, rendimiento 70 % y costo del kg limpio = `costo_total_usd / 14`.
5. **`NNNN_dashboard_cartera.sql`** (admin): `dashboard_aging_cartera()`, `dashboard_top_deudores(p_limite)`, `dashboard_flujo_proyectado(p_dias)`, `dashboard_exposicion_cambiaria()` (con `tasa_vigente(hoy, 'bcv'|'paralela')`: brecha `saldo × (paralela − bcv)`, brecha %, y resultado latente Σ `saldo × (tasa_vigente − tasa_snapshot)`, D7), `dashboard_contratos_sin_firmar()`. Función interna `dashboard_vencimiento_compra(compra_id)` (o CTE compartida) con la regla de D2: `contratos.fecha_vencimiento` del contrato `compra_credito` con `estado <> 'anulado'`, si no `compras.fecha + config_negocio.dias_credito_default`; la usan `dashboard_kpis_dia()` (CxP vencido) y el flujo. Sin `alter table` sobre `compras`.
   - Hecho: Σ de los tramos de aging = saldo CxC de `dashboard_kpis_dia()`; `p_dias` fuera de {7, 30} rechazado; una compra a crédito con contrato a 20 días vence a los 20, y una sin contrato vence a los `dias_credito_default`.
6. **`src/types/domain.ts`**: tipos listados en `spec.md` ("Arquitectura por capas"). Sin `any`.
   - Hecho: `tsc` sin errores; un tipo por resultado de RPC.

## Fase B — Dominio puro y validación

7. **`src/lib/dashboard/rangos.ts`**: `PresetRango`, `rangoDesdePreset(preset, hoy)`, `granularidadSpread(rango)` (semana si ≤ 120 días, si no mes), `mesesVentas(hasta)` (los 12 meses que terminan en el mes de `hasta`, D6).
8. **`src/lib/dashboard/series.ts`**: `rellenarSerie` (días/semanas/meses sin datos en 0), `paretoAcumulado(clientes)` (% y % acumulado, índice del corte 80 %), `ordenarTramosAging`.
9. **`src/lib/dashboardValidation.ts`**: `rangoFechasSchema` (`desde ≤ hasta`, ≤ 731 días, formato `YYYY-MM-DD`; si falta o es inválido, cae al preset "Mes en curso"), `diasFlujoSchema` (`7 | 30`).
10. **`scripts/probar-dashboard.ts`** (`npx tsx`, falla con `process.exit(1)`): presets (mes en curso el día 1, mes anterior en enero, año en curso), Pareto (corte exacto en 80 %), relleno de serie, rango inválido → default.
    - Hecho: el script pasa.

## Fase C — Repositorio y servicio

11. **`interfaces.ts` + `repositories/dashboardRepository.ts`**: `IDashboardRepository` con un método por RPC; `SupabaseDashboardRepository` solo hace `db.rpc(...)` y convierte `numeric` → `number`. Sin lógica.
12. **`services/dashboardService.ts`**: `getDashboard({ rango, diasFlujo })` → `{ rol, operativo, kpisDia?, analitica? , cartera? }`. Con operador no invoca ninguna RPC de admin. Resuelve la tasa vigente (`tasaService.getTasaVigente`, `fuente_tasa_default`) y calcula los Bs. Usa las funciones puras de Fase B. Errores de un bloque no tumban los demás (cada bloque devuelve `{ ok, data } | { ok: false, error }`).
    - Hecho: con rol operador, `analitica`, `kpisDia` y `cartera` son `undefined` y no hay llamadas a esas RPC (verificable en logs/red).

## Fase D — Gráficas y componentes genéricos

13. **Instalar `@mui/x-charts`** (D1): `npm i @mui/x-charts@^9`, misma versión mayor que `@mui/x-data-grid` (verificar compatibilidad con `@mui/material` v9 en su `peerDependencies`). Wrapper de colores desde `theme.palette` en `src/lib/dashboard/chartColors.ts` (sin hex).
    - Hecho: build sin errores; un gráfico de prueba en `/estandares` se ve en claro y oscuro.
14. **`molecules/KpiCard.tsx`**, **`molecules/ChartCard.tsx`**, **`molecules/ChartLegendTable.tsx`**, **`molecules/RangoFechasSelector.tsx`**. Registrar los cuatro en la tabla de "Componentes compartidos" de `00-estandares-ui/spec.md` y agregar muestra en `/estandares`.
    - Hecho: `RangoFechasSelector` escribe `?desde`/`?hasta` y conserva otros params; en `xs` usa `Select` + diálogo.

## Fase E — UI del dashboard

15. **Organisms de la fila del día y operativos**: `KpisDiaRow` (con `TasaChip`), `PedidosProximosList`, `AntiguedadLotesChart` (USD solo si viene), alertas de stock dentro de `KpisDiaRow`.
16. **Organisms de ventas y margen**: `VentasMensualesChart` (eje doble; tabs USD/kg en `xs`), `ProductosSalidaTable` (`AppDataGrid` cliente, `colKg`/`colMonto`), `ResultadoCambiarioCard` (Bs, separada del margen USD), `SpreadPrecioCostoChart` (filtro de producto), `MezclaVentasPanel`.
17. **Organisms de procesos e inventario**: `MermaProcesosPanel`, `RendimientoProveedorTable`, `PerdidasMotivoChart`, desglose de valor de inventario.
18. **Organisms de cartera y clientes**: `AgingCarteraChart`, `TopDeudoresList` (enlace a `/clientes/[id]`), `FlujoCajaChart` (toggle 7/30 en `?flujo=`), `ExposicionCambiariaCard`, `TopClientesPareto`, `ClientesInactivosList`, `ContratosSinFirmarList` (enlace a `/contratos`).
19. **`templates/DashboardTemplate.tsx`** + **`src/app/(protected)/page.tsx`** (reemplaza `PagePlaceholder`): Server Component, valida `searchParams`, `dashboardService.getDashboard`, `Suspense` por sección; **`loading.tsx`** (skeleton de KPIs + secciones) y **`error.tsx`** (`ErrorState`). Leer antes la guía de Next 16 en `node_modules/next/dist/docs/` (Suspense/streaming, `searchParams` como `Promise`).
    - Hecho: el operador ve solo tasa, pedidos, alertas y antigüedad en kg; el admin ve todo; cambiar el rango solo recarga la sección analítica.

## Fase F — Verificación

20. `npx tsx scripts/probar-dashboard.ts`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
21. Aplicar migraciones; con datos de prueba: ventas del día = Σ facturas de hoy; ventas por mes cuadran con `facturas`; margen por producto = Σ `factura_item_lotes`; merma = Σ `proceso_items`; aging suma el saldo CxC; valor de inventario igual al de `/inventario`.
22. Operador por PostgREST: cada RPC de admin responde `42501`; `dashboard_operativo` y `dashboard_antiguedad_lotes` sin importes; `dashboard_facturas_saldo_view` no legible.
23. 375/768/1024/1440 px y claro/oscuro en todas las secciones; gráficos con `aria-label` y tabla alternativa; sin hex en el código (`grep -E "#[0-9a-fA-F]{3,6}" src/components/**/Dashboard*` vacío).
24. Recorrer `checklist.md`.

## Notas de implementación (2026-10-08)

- Migraciones: `20261008000000_dashboard_base.sql` … `20261008000400_dashboard_cartera.sql` (escritas y probadas en un Postgres local de Supabase con datos de prueba; **pendiente aplicarlas al proyecto Supabase real**).
- Tarea 5: en lugar de `dashboard_vencimiento_compra(compra_id)` se usa la "CTE compartida" que la tarea admite, como vista interna `dashboard_compras_saldo_view` (sin `grant`), creada en la migración base (1/5) para que la usen `dashboard_kpis_dia()` (3/5) y `dashboard_flujo_proyectado()` (5/5). Regla de D2 intacta.
- Internas sin `grant` a `authenticated`: `dashboard_hoy()`, `dashboard_exigir_admin()`, `dashboard_lineas_venta()`, `dashboard_facturas_saldo_view`, `dashboard_compras_saldo_view`.
- Stock bajo y lote antiguo usan exactamente el criterio de `/inventario` (07): stock ≤ umbral (`valorizarLotes`) y días en cava ≥ `dias_alerta_lote` (`esAntiguo`), por precedente.
- `@mui/x-charts` fijado a `~9.14.0`: la 9.15 arrastra `@mui/x-internals` 9.15, que ya no exporta subrutas que usa `@mui/x-data-grid` 9.14 (el build falla). Al subir `x-data-grid`/`x-date-pickers` a 9.15, subir también las gráficas.
- La página vive en el grupo `src/app/(protected)/(dashboard)/` (misma ruta `/`) para tener `loading.tsx`/`error.tsx` propios sin cambiar el respaldo de las demás rutas.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "Cuentas por pagar agrega `compras.fecha_vencimiento`: reemplazar la regla de D2 en `dashboard_vencimiento_compra` — <fecha>")_
