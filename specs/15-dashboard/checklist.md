# Checklist — 15-dashboard

## Decisiones
- [x] D1–D7 de `spec.md` aprobadas por el usuario el 2026-10-08 tal como se propusieron (ver "Decisiones cerradas").
- [x] D2 respetada: no hay `alter table` sobre `compras`; el vencimiento de CxP sale del contrato `compra_credito` activo o de `compras.fecha + dias_credito_default` (`dashboard_compras_saldo_view`; probado: con contrato a 20 días vence a los 20, sin contrato a los 15 del default).

## Datos y seguridad (migraciones + RLS)
- [x] Migraciones nuevas e incrementales (`20261008000000_dashboard_base.sql` … `20261008000400_dashboard_cartera.sql`); ninguna migración aplicada fue editada; sin tablas nuevas. **Pendiente: aplicarlas al proyecto Supabase real** (no hay acceso desde aquí; se probaron en un Postgres local de Supabase con todas las migraciones previas).
- [x] Todas las funciones `dashboard_*` son `security definer`, `set search_path = public`, con `revoke … from public, anon` y `grant execute … to authenticated` (las internas, además, sin `grant` a `authenticated`).
- [x] Las RPC de importes fallan con `42501` para el operador. Probado en SQL con `set role authenticated` + `request.jwt.claims` de un operador (las 17 RPC de admin → `42501`). Diferido: repetir por PostgREST contra el proyecto real cuando se apliquen las migraciones.
- [x] `dashboard_operativo` y `dashboard_antiguedad_lotes` no devuelven costos ni montos al operador (`null`) — probado como operador.
- [x] `dashboard_facturas_saldo_view` no es legible por `authenticated` (`permission denied`) y replica la regla de `lib/cartera/estado.ts` (comentario cruzado; consulta de comparación con `cartera_clientes_view` → 0 diferencias).
- [x] "Hoy" calculado en `America/Caracas` en SQL (`dashboard_hoy()` / en línea en las vistas) y con `fechaHoy()` en TS.
- [x] Índices nuevos: `create index if not exists` sobre las fechas de `facturas` (parcial no anuladas), `pagos`, `pagos_proveedores`, `procesamientos`, `perdidas_lote`, `notas_credito` (emitidas) y `pedidos (estado, fecha_entrega)`. Con el volumen de prueba `explain` elige seq scan (tablas pequeñas); se agregan por los predicados de rango sobre tablas que crecen a diario (anotado en la migración).

## Cálculos (cuadran con la fuente)
- [x] Ventas del día / por mes / ticket promedio cuadran con `facturas` no anuladas, sin IVA y netas de notas de crédito por la fecha de la nota (D4). Datos de prueba: venta 120 − NC 24 = 96 USD, 8 kg.
- [x] Margen por producto = precio − costo snapshot por línea (= Σ `factura_item_lotes` peso × costo: 71,43 en la prueba); margen bruto USD (`ProductosSalidaTable`) y resultado cambiario Bs (`ResultadoCambiarioCard`) en tarjetas separadas.
- [x] Resultado cambiario: cobros y pagos a proveedores por separado y neto = cobros − pagos (D5) (prueba: 80 − 5 = 75 Bs).
- [x] Merma, rendimiento y costo del kg limpio cuadran con `proceso_items` (§4.3): 20 → 14 kg da merma 6 kg, rendimiento 70 %, kg limpio = 100/14; rendimiento por proveedor vía lote origen.
- [x] Pérdidas por motivo cuadran con `perdidas_lote` (los cinco motivos, incluido `cierre`).
- [x] Antigüedad de lotes por tramos fijos 0–2 / 3–5 / > 5 días desde `fecha_ingreso` (D3).
- [x] Ventas por mes muestra los 12 meses que terminan en el mes de `hasta` (D6); el último mes corta en `hasta`.
- [x] Valor del inventario USD/Bs con el criterio de `/inventario` (lotes `abierto` con stock de productos activos; Bs a la tasa vigente de `fuente_tasa_default`). Diferido: comparación visual contra `/inventario` con datos reales (no se pudo iniciar sesión en el navegador).
- [x] Aging: Σ tramos = saldo CxC de `dashboard_kpis_dia()` (200,56 en la prueba); top deudores con el mismo saldo que `cartera_clientes_view`.
- [x] Flujo proyectado 7/30 con vencido aparte; pagos de CxP por el vencimiento derivado de D2; `p_dias` fuera de {7, 30} → `22023`.
- [x] Exposición cambiaria (D7): brecha BCV/paralela sobre el saldo CxC y resultado latente respecto de la tasa de cada factura (prueba: 802,24 y 579,52 Bs, verificados a mano).
- [x] Pareto (corte 80 %, inclusive; script), clientes inactivos > 30 días, pedidos hoy/mañana/atrasados y contratos `generado`/`enviado` correctos (probado en SQL).

## Repositorios y servicios
- [x] `IDashboardRepository` + `makeDashboardRepository` (Supabase): solo llamadas RPC y mapeo de tipos, sin lógica de negocio.
- [x] `dashboardService` es el único que usa el repositorio; aplica el rol y no invoca RPC de admin para el operador (`getKpisDia`/`getAnalitica`/`getCartera` devuelven `undefined` antes de llamar).
- [x] Un bloque con error no tumba el resto del dashboard (`BloqueDashboard` por bloque + `ChartCard` con `ErrorState` y reintento).
- [x] `src/lib/dashboard/` puro (sin Supabase ni React; `chartColors` recibe el theme); `scripts/probar-dashboard.ts` pasa.
- [x] `?desde`/`?hasta` validados con `rangoFechasSchema` en el servidor (inválido → mes en curso); `?flujo` y `?producto` también.

## UI (Atomic Design y `00-estandares-ui`)
- [x] `page.tsx` solo compone `DashboardTemplate` con las secciones (Server Components en `(dashboard)/dashboard-secciones.tsx`); organisms por bloque; `KpiCard`, `ChartCard`, `ChartLegendTable`, `RangoFechasSelector` (y `ListaResumen`) como molecules genéricas.
- [x] Componentes nuevos registrados en la tabla de "Componentes compartidos" de `00-estandares-ui/spec.md` (más `BarLineChart` y la variante `dashboard` de `PageLoader`).
- [x] `@mui/x-charts` instalado (D1, `~9.14.0`, misma versión que `x-data-grid`; ver nota en `tasks.md` sobre la 9.15); colores solo desde `theme.palette` vía variables CSS (sin hex, sin `brand.ochre`; grep vacío).
- [ ] Modo claro y oscuro revisados en todas las secciones y gráficos. **Diferido**: no se pudo iniciar sesión en el navegador (la autenticación es el Supabase remoto y no se ingresan credenciales); los colores salen de variables CSS del theme, que cambian solas con el esquema. Revisar en `/` y en la muestra de `/estandares`.
- [ ] Responsive a 375/768/1024/1440 px; eje doble con tabs USD/kg en `xs`; sin scroll horizontal de página. **Diferido** (mismo motivo). Implementado: grids 1/2/4, tabs en `xs`, tablas con `mobileCard`, `min-w-0` en contenedores.
- [x] `loading.tsx` con skeleton (`PageLoader variant="dashboard"`), `Suspense` por sección (claves por rango/flujo), `error.tsx` con `ErrorState`, `EmptyState compact` en secciones sin datos.
- [x] Números con `lib/format.ts` (`formatUsd`/`formatBs`/`formatKg`/`formatTasa` + nuevos `formatPct`, `formatEntero`, `formatUsdCorto`, `formatKgCorto`), cifras tabulares, montos a la derecha.
- [x] Gráficos con `aria-label` y tabla alternativa (`ChartLegendTable`); `prefers-reduced-motion` lo respeta `@mui/x-charts` (`useChartAnimation`).
- [ ] Vista por rol verificada en navegador: operador solo tasa, pedidos, alertas y antigüedad en kg. **Diferido** (sin sesión en el navegador). Verificado en código: la página no pide ni renderiza secciones de admin si `rol !== 'admin'`, y en SQL las RPC lo refuerzan.

## Tipos y calidad
- [x] Tipos nuevos en `src/types/domain.ts`; sin `any`.
- [x] `npm run lint` (0 errores; 1 warning previo en `NotaCreditoForm.tsx`), `npx tsc --noEmit` y `npm run build` sin errores.

## Pendientes / deuda técnica
- [ ] (2026-10-08) Lectura directa de `facturas`/`pagos`/`compras`/`pagos_proveedores`/`proceso_items` por el operador (RLS de `0001`): fuera de alcance de este módulo.
- [ ] (2026-10-08) Aplicar las 5 migraciones `20261008*_dashboard_*.sql` al proyecto Supabase y repetir la prueba de `42501` por PostgREST con un operador.
- [ ] (2026-10-08) Revisión visual en navegador (claro/oscuro, 375/768/1024/1440, vista de operador) con una sesión real.
