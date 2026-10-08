# 15 — Dashboard: KPIs del día y analítica por período

## Contexto

Es la pantalla 7 de `/SPEC.md` §7 ("tasa del día, ventas/margen del día, CxC/CxP, alertas de stock"), la última del orden acordado. Hoy `src/app/(protected)/page.tsx` es un `PagePlaceholder`.

Alcance acordado con el usuario el **2026-10-08**: además de lo de §7, pidió ventas por mes (USD + kg), merma por procesos, margen bruto USD separado del resultado cambiario Bs, volumen en kg, productos con salida, CxC y CxP, y aprobó 14 indicadores agregados (ver "Alcance").

Lo que ya existe y se reutiliza (no se recalcula de otra forma):

| Pieza existente | Dónde | Uso en el dashboard |
|---|---|---|
| Regla de estado de cobro (saldo = total − pagado − notas de crédito emitidas; vencida si `hoy > fecha_vencimiento`) | `src/lib/cartera/estado.ts` + `cartera_clientes_view` (`20261007170200_cartera_clientes_view.sql`) | Aging, top deudores, flujo de cobros, exposición |
| "Hoy" = fecha de Venezuela | `(now() at time zone 'America/Caracas')::date` en SQL, `fechaHoy()` en `lib/format.ts` | Toda referencia a "hoy"/"mañana" |
| Stock por lote (Σ ledger) y costo protegido | `lotes_view`, `lotes_stock` (`20261007180200_lotes_vistas.sql`) | Valor de inventario, antigüedad, alertas |
| Valorización por lote + stock bajo | `costingService.getInventarioPorLotes(…, umbral_stock_bajo_kg)` | Mismo criterio para "alertas de stock" |
| Tasa vigente por fecha valor | `tasa_vigente(fecha, fuente, moneda)` (`0018`) y `tasaService.getTasaVigente` | Tasa del día, valor en Bs, exposición |
| Fuente de tasa preferida | `config_negocio.fuente_tasa_default` | Conversión a Bs (igual que `/inventario`) |
| Lote "antiguo" | `config_negocio.dias_alerta_lote` (07) | Alerta de lotes antiguos |
| Saldo de proveedor | `proveedorBalanceService` (`subtotal_usd − pagado_usd` de compras abiertas) | CxP |
| Ganancia cambiaria por abono | `pagos.ganancia_cambiaria_bs`, `pagos_proveedores.ganancia_cambiaria_bs` (fórmula de `creditService.gananciaCambiariaBs`, §4.5) | Resultado cambiario |
| Costo de venta snapshot | `factura_items.costo_usd_kg` (promedio de `factura_item_lotes`, §4.6) | Margen |

Hallazgos del código que condicionan el diseño:

1. **`compras` no tiene `fecha_vencimiento` ni `dias_credito`** (solo `contratos` de tipo `compra_credito` los tiene, y solo si se generó contrato). Resuelto en **D2** (vencimiento derivado, sin cambiar el esquema).
2. **No hay librería de gráficas** (`package.json`: `@mui/material`/`x-data-grid`/`x-date-pickers` v9; `08-tasas` evitó gráficos por eso) → resuelto en **D1** (`@mui/x-charts`).
3. Las tablas base `facturas`, `pagos`, `compras`, `pagos_proveedores` y `proceso_items` siguen legibles para `authenticated` (RLS `read_all` de `0001`; anotado ya en el checklist de 09). Este módulo **no** lo cambia (fuera de alcance), pero ningún indicador sensible se arma en el cliente: todo sale de RPCs que verifican `es_admin()`.

## Decisión de diseño

- **Cálculos en Supabase, no en el cliente**: funciones SQL `dashboard_*` (`language sql`/`plpgsql`, `stable`, `security definer`, `set search_path = public`), con `revoke all … from public, anon` y `grant execute … to authenticated`. Las de importes **fallan** con `raise exception … using errcode = '42501'` si `not es_admin()` (no devuelven ceros silenciosos). Las operativas no exponen costos ni montos. Mismo enfoque de `security definer` que `0003` / `lotes_vistas`.
- **Sin tablas nuevas.** Solo funciones, una vista auxiliar de saldos de facturas y, si hace falta, índices.
- **Una RPC por bloque** (SRP), agrupadas en migraciones por tema; el servicio las compone. Nada de una RPC gigante con `jsonb`.
- **Montos de ventas en USD sin IVA** (`subtotal_usd`): el IVA no es ingreso del negocio. El ticket promedio también va sin IVA (D4).
- **Facturas anuladas excluidas** de todo indicador de ventas y margen; ventas netas de notas de crédito emitidas (D4).
- **Margen bruto (USD) y resultado cambiario (Bs) nunca se suman** ni se muestran en la misma cifra: son tarjetas separadas, con su moneda.
- **Vista por rol** (aplicada en el servidor, `getRol()`, y reforzada en las RPC):

| Bloque | Operador | Admin |
|---|---|---|
| Tasa del día (BCV/paralela/EUR) | sí | sí |
| Pedidos agendados hoy/mañana pendientes (+ atrasados) | sí (sin montos) | sí |
| Alertas de stock (kg) y lotes antiguos | sí (kg) | sí |
| Antigüedad de lotes abiertos | kg | kg + USD |
| Ventas/margen del día, CxC, CxP, valor de inventario | no | sí |
| Toda la sección analítica por período | no | sí |
| Contratos sin firmar | no (contratos son solo admin, 06) | sí |

## Alcance

### A. Fila de KPIs del día (arriba, sin selector de fechas)

| KPI | Definición | Fuente |
|---|---|---|
| Tasa del día | Vigentes de hoy BCV y paralela USD, EUR de referencia; aviso si arrastrada | `tasaService.getTasaVigente` + `TasaChip` (08) |
| Ventas del día | Σ `subtotal_usd`, Σ kg y n.º de facturas no anuladas con `fecha = hoy` | `dashboard_kpis_dia()` |
| Margen del día | Σ `(precio_usd_kg − costo_usd_kg) × peso_kg` de esas facturas, en USD y % sobre ventas | `dashboard_kpis_dia()` |
| CxC | Saldo total, saldo vencido y n.º de clientes con vencidas | `dashboard_kpis_dia()` (misma regla que `cartera_clientes_view`) |
| CxP | Saldo `subtotal_usd − pagado_usd` de compras a crédito `abierta`; vencido con el vencimiento derivado de D2 | `dashboard_kpis_dia()` |
| Valor del inventario | Σ `stock_kg × costo_usd_kg` de lotes con stock > 0, en USD y en Bs a la tasa vigente de `fuente_tasa_default` (§4.1) | `dashboard_kpis_dia()` + tasa |
| Alertas de stock | Productos con `controla_stock` y activos con stock < `umbral_stock_bajo_kg` (si no es `null`); lotes abiertos con días en cava > `dias_alerta_lote` (D3) | `dashboard_operativo()` |
| Pedidos próximos | Pedidos `pendiente` con `fecha_entrega` = hoy / mañana, y atrasados (`fecha_entrega < hoy`) | `dashboard_operativo()` |

`dashboard_kpis_dia()` (admin) devuelve una fila; `dashboard_operativo()` (cualquier autenticado) devuelve solo kg, conteos y listas sin importes.

### B. Sección analítica por período (admin)

Selector de rango (`?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` en la URL, validado con zod: `desde ≤ hasta`, máximo 731 días). Atajos: Hoy, Últimos 7 días, Mes en curso (default), Mes anterior, Últimos 90 días, Año en curso, Personalizado (DatePickers). Todas las fechas de corte son `date` (fecha del documento), inclusive en ambos extremos.

| # | Indicador | Definición | RPC |
|---|---|---|---|
| B1 | **Ventas por mes** (USD + kg, eje doble) | Por mes calendario: Σ `subtotal_usd` (barras, eje izq.) y Σ kg (línea, eje der.). Siempre los 12 meses que terminan en el mes de `hasta` (D6) | `dashboard_ventas_mensuales(p_desde, p_hasta)` |
| B2 | **Volumen y productos con salida** | Por producto con kg vendidos en el período: kg, ventas USD, n.º de facturas, precio medio/kg. Total de kg del período | `dashboard_productos_salida(p_desde, p_hasta)` |
| B3 | **Margen por producto** (agregado 4) | En la misma fila de B2: costo USD (Σ `costo_usd_kg × peso_kg`), margen USD y margen % (`margen / ventas`). Total = margen bruto del período | idem B2 |
| B4 | **Margen bruto USD vs resultado cambiario Bs** | Margen bruto USD (B3). Resultado cambiario Bs = Σ `pagos.ganancia_cambiaria_bs` (cobros del período) y Σ `pagos_proveedores.ganancia_cambiaria_bs` (pagos del período), mostrados por separado y su neto = cobros − pagos a proveedores (D5) | `dashboard_resultado_cambiario(p_desde, p_hasta)` |
| B5 | **Spread precio vs costo por kg** (agregado 5) | Por semana ISO (o mes si el rango > 120 días): precio medio = Σ(precio×kg)/Σkg, costo medio = Σ(costo×kg)/Σkg, spread = diferencia. Filtro opcional por producto | `dashboard_spread_precio_costo(p_desde, p_hasta, p_producto_id uuid default null)` |
| B6 | **Merma por procesos** | Por producto de origen, con `procesamientos.fecha` en el período: kg entrada, kg salida, merma kg (`entrada − salida`), merma %, rendimiento (`salida / entrada`, §4.3), y costo de la merma USD (`merma_kg × costo_usd_kg` del lote origen) | `dashboard_merma_procesos(p_desde, p_hasta)` |
| B7 | **Rendimiento por proveedor y costo del kg limpio** (agregado 6) | Agrupado por `lotes.proveedor_id` del lote origen (`proceso_items.lote_origen_id`) y producto: rendimiento %, merma %, costo kg crudo medio y **costo real del kg limpio** = Σ `costo_total_usd` / Σ `peso_salida_kg` | `dashboard_rendimiento_proveedor(p_desde, p_hasta)` |
| B8 | **Pérdidas fuera de proceso por motivo** (agregado 3) | `perdidas_lote` del período por `motivo` (`danado`, `vencido`, `faltante`, `cierre`, `otro`): kg y USD (`peso_kg × lotes.costo_usd_kg`), y n.º de registros | `dashboard_perdidas_motivo(p_desde, p_hasta)` |
| B9 | **Contado vs crédito** (agregado 10) | % y USD de ventas del período por `facturas.condicion` | `dashboard_mezcla_ventas(p_desde, p_hasta)` |
| B10 | **Mezcla de métodos de pago** (agregado 10) | Σ `monto_usd` de `pagos` del período por `metodo` (`efectivo_usd`, `efectivo_bs`, `pago_movil`, `zelle`, `transferencia`, `punto`) y por `moneda_pago` | idem B9 |
| B11 | **Ticket promedio** (agregado 12) | Ventas USD / n.º de facturas no anuladas del período; también kg por factura | idem B9 |
| B12 | **Top clientes (Pareto)** (agregado 11) | Clientes ordenados por ventas USD del período, % y % acumulado; se marca el corte del 80 %. Top 10 + "Resto" | `dashboard_top_clientes(p_desde, p_hasta, p_limite int default 10)` |

### C. Cartera, flujo y riesgo (admin; foto a hoy, no dependen del rango)

| # | Indicador | Definición | RPC |
|---|---|---|---|
| C1 | **Aging de cartera** (agregado 7) | Saldo USD y n.º de facturas con saldo > 0,005 por tramo: **Por vencer** (no vencida: `hoy ≤ fecha_vencimiento`), **1–15**, **16–30**, **> 30** días vencida | `dashboard_aging_cartera()` |
| C2 | **Top deudores** (agregado 7) | Clientes por saldo USD desc. (top 10): saldo, vencido, días de la vencida más antigua, enlace a la ficha | `dashboard_top_deudores(p_limite int default 10)` |
| C3 | **Flujo de caja proyectado 7/30 días** (agregado 8) | Por día de los próximos N días: cobros esperados = saldos de facturas con `fecha_vencimiento` ese día; pagos esperados = saldos de compras a crédito que vencen ese día (vencimiento derivado de D2). Bloque aparte "Vencido sin cobrar / sin pagar" (no se reparte en días). Acumulado neto | `dashboard_flujo_proyectado(p_dias int)` (7 o 30) |
| C4 | **Exposición cambiaria** (agregado 9) | Saldo CxC USD; tasas vigentes BCV y paralela de hoy; brecha % = `paralela / bcv − 1`; brecha Bs = `saldo × (paralela − bcv)`; resultado latente = Σ `saldo × (tasa_vigente − tasa_snapshot)` por factura (D7) | `dashboard_exposicion_cambiaria()` |
| C5 | **Clientes inactivos** (agregado 11) | Clientes `activo` con al menos una factura no anulada y última factura hace > 30 días (o `p_dias`): última compra, días, ventas USD de los últimos 90 días previos | `dashboard_clientes_inactivos(p_dias int default 30)` |

### D. Inventario y operación

| # | Indicador | Rol | Definición | RPC |
|---|---|---|---|---|
| D1 | **Antigüedad de lotes abiertos** (agregado 1) | operador: kg; admin: kg + USD | Lotes `abierto` con stock > 0, por días en cava desde `fecha_ingreso` hasta hoy: **0–2**, **3–5**, **> 5** días (rangos fijos, D3). kg y n.º de lotes por tramo; USD = Σ `stock × costo_usd_kg` (solo admin) | `dashboard_antiguedad_lotes()` (importe `null` si no admin, patrón `0003`) |
| D2 | **Valor del inventario USD y Bs** (agregado 2) | admin | Ver fila A; además desglose por producto (top 10 por valor) | `dashboard_kpis_dia()` + `dashboard_valor_inventario()` |
| D3 | **Pedidos agendados hoy/mañana** (agregado 13) | ambos | Lista: cliente, n.º de ítems, kg estimados, fecha de entrega, enlace a `/pedidos`; admin ve además el USD estimado (Σ `peso_estimado_kg × precio_usd_kg`) | `dashboard_operativo()` |
| D4 | **Contratos sin firmar** (agregado 14) | admin | Contratos con `estado in ('generado', 'enviado')`: número, tipo, contraparte, fecha, vencimiento, días desde generado; enlace a `/contratos` | `dashboard_contratos_sin_firmar()` |

### Vista auxiliar

`dashboard_facturas_saldo_view` (o función interna equivalente, sin `grant` a `authenticated`): por factura no anulada, `saldo_usd = total_usd − pagado_usd − Σ notas_credito.total_usd (estado = 'emitida')`, `fecha_vencimiento` y `dias_vencida`. Replica la regla de `lib/cartera/estado.ts` con comentario cruzado (igual que `cartera_clientes_view`); la usan C1–C4 y la fila A. No se modifica `cartera_clientes_view`.

### Arquitectura por capas

| Pieza | Responsabilidad | Ubicación |
|---|---|---|
| Funciones puras | Presets de rango (`rangoDesdePreset`, `validarRango`), granularidad del spread, acumulado de Pareto y corte del 80 %, ordenar tramos de aging, rellenar días/meses sin datos con 0 | `src/lib/dashboard/*.ts` (sin Supabase ni React) |
| Validación | `rangoFechasSchema` (zod) para `?desde`/`?hasta`, `p_dias ∈ {7, 30}` | `src/lib/dashboardValidation.ts` |
| `IDashboardRepository` + `SupabaseDashboardRepository` | Solo llama a las RPC `dashboard_*` y mapea `numeric` → `number` | `src/lib/repositories/interfaces.ts`, `src/lib/repositories/dashboardRepository.ts` |
| `dashboardService` | Aplica el rol (no llama RPC de admin si el rol es operador), compone bloques con `Promise.all`, resuelve tasa vigente y conversión a Bs, aplica funciones puras | `src/lib/services/dashboardService.ts` |
| Tipos | `RangoFechas`, `PresetRango`, `KpisDia`, `DashboardOperativo`, `VentaMensual`, `ProductoSalida`, `ResultadoCambiario`, `PuntoSpread`, `MermaProceso`, `RendimientoProveedor`, `PerdidaPorMotivo`, `MezclaVentas`, `ClienteRanking`, `TramoAging`, `TramoAntiguedad`, `FlujoDia`, `ExposicionCambiaria`, `ClienteInactivo`, `PedidoProximo`, `ContratoPendienteFirma` | `src/types/domain.ts` |

### UI (Atomic Design, `00-estandares-ui`)

- `page.tsx` (Server Component): lee `searchParams`, valida el rango, llama a `dashboardService` y compone `templates/DashboardTemplate`. Cada sección pesada en su propio `Suspense` con skeleton para que una consulta lenta no bloquee la fila de KPIs (revisar la guía de Next 16 en `node_modules/next/dist/docs/` antes de implementar). `loading.tsx` y `error.tsx` con `PageLoader`/`ErrorState`.
- **Componentes genéricos nuevos** (registrar en la tabla de `00-estandares-ui/spec.md`):

| Componente | Capa | Para qué |
|---|---|---|
| `KpiCard` | molecule | Título `body2`, cifra protagonista `h5` (Barlow Condensed, tabular), secundaria `caption`, acento de estado opcional (`error`/`warning`), `href` opcional, `loading` (skeleton) |
| `RangoFechasSelector` | molecule | Chips de presets + "Personalizado" con `DatePicker` desde/hasta; escribe `?desde`/`?hasta` con `router.replace`; en `xs` un `Select` + diálogo |
| `ChartCard` | molecule | Tarjeta de sección (radio 8, borde `divider`, sin sombra): título `h6`, ayuda, acción opcional, `EmptyState compact` sin datos, `ErrorState` en error, skeleton al cargar |
| `ChartLegendTable` | molecule | Alternativa accesible al gráfico: tabla con los mismos datos (`visually hidden` o colapsable) |

- **Organisms del dominio**: `KpisDiaRow`, `VentasMensualesChart` (eje doble), `ProductosSalidaTable` (`AppDataGrid` modo cliente, columnas `colKg`/`colMonto`, margen % con color), `ResultadoCambiarioCard`, `SpreadPrecioCostoChart`, `MermaProcesosPanel`, `RendimientoProveedorTable`, `PerdidasMotivoChart`, `MezclaVentasPanel` (contado/crédito + métodos + ticket), `TopClientesPareto`, `AgingCarteraChart` + `TopDeudoresList`, `FlujoCajaChart` (toggle 7/30), `ExposicionCambiariaCard`, `ClientesInactivosList`, `AntiguedadLotesChart`, `PedidosProximosList`, `ContratosSinFirmarList`.
- **Template** `DashboardTemplate`: fila de KPIs (grid 1 col `xs`, 2 `sm`, 4 `md+`), bloque operativo, y para admin `RangoFechasSelector` + secciones "Ventas y margen", "Procesos e inventario", "Cartera y flujo", "Clientes". El operador no recibe ni renderiza las secciones de admin (no se ocultan por CSS: no se piden).
- **Gráficas**: colores solo desde `theme.palette` (`primary`, `secondary`, `success`, `warning`, `error`, `info`, `text.secondary`); nunca hex ni `brand.ochre` (decorativo). Probadas en claro y oscuro. Ejes con `formatUsd`/`formatKg`/`formatBs`, tooltips con los mismos formatos, sin animaciones de terceros (las del propio paquete de gráficas se respetan con `prefers-reduced-motion`). Cada gráfico tiene `aria-label` y su `ChartLegendTable`.
- Todo número con `lib/format.ts`; cifras tabulares; montos alineados a la derecha en tablas.
- Responsive: 375/768/1024/1440 px; los gráficos con eje doble pasan a una sola serie con tabs USD/kg en `xs`.

### Rendimiento

- Índices nuevos si `explain` lo justifica: `facturas (fecha) where estado <> 'anulada'`, `pagos (fecha)`, `pagos_proveedores (fecha)`, `procesamientos (fecha)`, `perdidas_lote (fecha)`, `pedidos (estado, fecha_entrega)`. Con `create index if not exists`.
- Sin vistas materializadas ni caché en MVP (volumen de una pescadería pequeña). La página es dinámica (datos al día).

## Decisiones cerradas (aprobadas por el usuario el 2026-10-08)

| # | Tema | Resolución |
|---|---|---|
| D1 | **Librería de gráficas** | **`@mui/x-charts`** (versión community MIT, alineada con `x-data-grid` v9; usa el theme MUI y el modo oscuro). Amplía el stack de `/SPEC.md` §3 sin reabrir ninguna decisión. Descartadas: `recharts` y SVG propio |
| D2 | **Vencimiento de CxP** (`compras` no tiene `fecha_vencimiento`) | Vencimiento de una compra a crédito abierta = `contratos.fecha_vencimiento` del contrato `compra_credito` activo (estado ≠ `anulado`) si existe; si no, `compras.fecha + config_negocio.dias_credito_default`. **No se cambia el esquema de `compras`** (ni de `04-inventario`). Agregar `compras.fecha_vencimiento` queda para el futuro módulo de cuentas por pagar |
| D3 | **Alertas de stock y rangos de antigüedad** | Stock bajo = productos activos con `controla_stock` y stock < `umbral_stock_bajo_kg` global (criterio de `/inventario`); si el umbral es `null`, esa alerta no se muestra. Lotes antiguos = abiertos con días en cava > `dias_alerta_lote`. **Rangos de antigüedad fijos: 0–2, 3–5 y > 5 días** (no derivados de `dias_alerta_lote`) |
| D4 | **Notas de crédito e IVA** | Ventas, kg y margen **netos de notas de crédito emitidas** (por la fecha de la nota; el margen descuenta lo devuelto al costo de la línea). Montos de venta y ticket **sin IVA** (`subtotal_usd`) |
| D5 | **Signo del resultado cambiario en CxP** | Se muestran por separado Σ `pagos.ganancia_cambiaria_bs` (cobros) y Σ `pagos_proveedores.ganancia_cambiaria_bs` (pagos a proveedores, misma fórmula: positivo = mayor desembolso en Bs), y el **neto = cobros − pagos a proveedores**, etiquetado "Resultado cambiario neto (Bs)" |
| D6 | **Rango del gráfico de ventas por mes** | Siempre los **12 meses que terminan en el mes de `hasta`**, independiente del inicio del rango |
| D7 | **Exposición cambiaria** | En la misma tarjeta, informativos y en Bs: a) brecha BCV/paralela sobre el saldo CxC (`saldo × (paralela − bcv)` y brecha % = `paralela / bcv − 1`); b) resultado latente del saldo CxC respecto de la tasa de cada factura: Σ `saldo × (tasa_vigente − tasa_snapshot)` |

Ya resueltas por precedente (no se reabren): "hoy" = `America/Caracas` (09); tasa para Bs = vigente de `fuente_tasa_default` (como `/inventario`); "antiguo" = `dias_alerta_lote` (07).

## Fuera de alcance (MVP)

- Exportar a CSV/PDF o enviar el dashboard por correo.
- Comparación contra período anterior, metas o presupuestos.
- Pronósticos de demanda o de tasa.
- Actualización en tiempo real (realtime de Supabase) y notificaciones push de alertas.
- Vistas materializadas o caché de agregados.
- Cerrar la lectura directa de `facturas`/`pagos`/`compras`/`pagos_proveedores`/`proceso_items` por el operador (RLS de `0001`); se anota como deuda, no se toca aquí.
- Aging de CxP por proveedor con recordatorios (pertenece al futuro módulo de cuentas por pagar).
- Dashboard para el operador con importes (decisión de `/SPEC.md` §5: el operador no ve costos, balances ni márgenes).

## Variables de entorno nuevas

Ninguna.
