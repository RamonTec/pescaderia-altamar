-- 15-dashboard (3/5): KPIs del día y analítica de ventas (solo admin).
--
-- Todas llaman primero a `dashboard_exigir_admin()`: con un operador fallan
-- con `42501` (no devuelven ceros). Ventas, kg y margen salen de
-- `dashboard_lineas_venta` (1/5): facturas no anuladas, netas de notas de
-- crédito emitidas por la fecha de la nota, sin IVA (D4).
--
-- Fechas de corte: `date` del documento, inclusive en ambos extremos.

-- ============ dashboard_kpis_dia ============
-- Una fila: ventas/kg/n.º/margen de hoy; CxC (misma regla que
-- `cartera_clientes_view`); CxP con el vencimiento derivado de D2; valor del
-- inventario USD (lotes abiertos con stock de productos activos, igual que
-- `/inventario`). La conversión a Bs la hace el servicio con la tasa vigente
-- de `fuente_tasa_default`.
create or replace function public.dashboard_kpis_dia()
returns table (
  hoy date,
  ventas_usd numeric,
  ventas_kg numeric,
  facturas int,
  costo_usd numeric,
  margen_usd numeric,
  cxc_saldo_usd numeric,
  cxc_vencido_usd numeric,
  cxc_facturas int,
  cxc_clientes_vencidos int,
  cxp_saldo_usd numeric,
  cxp_vencido_usd numeric,
  cxp_compras int,
  inventario_usd numeric,
  inventario_kg numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hoy date := public.dashboard_hoy();
begin
  perform public.dashboard_exigir_admin();

  return query
  with ventas as (
    select
      coalesce(sum(l.venta_usd), 0) as venta,
      coalesce(sum(l.kg), 0) as kg,
      count(distinct l.factura_id) filter (where not l.es_nota)::int as n,
      coalesce(sum(l.costo_usd), 0) as costo
    from public.dashboard_lineas_venta(v_hoy, v_hoy) l
  ),
  cxc as (
    select
      coalesce(sum(s.saldo_usd), 0) as saldo,
      coalesce(sum(s.saldo_usd) filter (where s.vencida), 0) as vencido,
      count(*)::int as n,
      count(distinct s.cliente_id) filter (where s.vencida)::int as clientes_vencidos
    from public.dashboard_facturas_saldo_view s
    where s.saldo_usd > 0.005
  ),
  cxp as (
    select
      coalesce(sum(c.saldo_usd), 0) as saldo,
      coalesce(sum(c.saldo_usd) filter (where c.vencida), 0) as vencido,
      count(*)::int as n
    from public.dashboard_compras_saldo_view c
    where c.saldo_usd > 0.005
  ),
  inv as (
    select
      coalesce(sum(x.stock_kg * x.costo_usd_kg), 0) as valor,
      coalesce(sum(x.stock_kg), 0) as kg
    from (
      select l.costo_usd_kg, sum(m.peso_kg) as stock_kg
      from public.lotes l
      join public.productos p on p.id = l.producto_id and p.activo
      join public.movimientos m on m.lote_id = l.id
      where l.estado = 'abierto'
      group by l.id
      having sum(m.peso_kg) > 0
    ) x
  )
  select
    v_hoy,
    v.venta, v.kg, v.n, v.costo, v.venta - v.costo,
    a.saldo, a.vencido, a.n, a.clientes_vencidos,
    p.saldo, p.vencido, p.n,
    i.valor, i.kg
  from ventas v, cxc a, cxp p, inv i;
end;
$$;

revoke all on function public.dashboard_kpis_dia() from public, anon;
grant execute on function public.dashboard_kpis_dia() to authenticated;

-- ============ dashboard_ventas_mensuales ============
-- D6: siempre los 12 meses que terminan en el mes de `p_hasta` (`p_desde` no
-- recorta la serie; se recibe por simetría con el resto de la analítica). El
-- último mes llega hasta `p_hasta`. Meses sin ventas en 0.
create or replace function public.dashboard_ventas_mensuales(p_desde date, p_hasta date)
returns table (
  mes date,
  ventas_usd numeric,
  kg numeric,
  facturas int
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_fin_mes date := date_trunc('month', p_hasta)::date;
  v_inicio date := (date_trunc('month', p_hasta) - interval '11 months')::date;
begin
  perform public.dashboard_exigir_admin();

  return query
  with meses as (
    select generate_series(v_inicio, v_fin_mes, interval '1 month')::date as mes
  ),
  lineas as (
    select date_trunc('month', l.fecha)::date as mes, l.*
    from public.dashboard_lineas_venta(v_inicio, p_hasta) l
  )
  select
    m.mes,
    coalesce(sum(l.venta_usd), 0),
    coalesce(sum(l.kg), 0),
    (count(distinct l.factura_id) filter (where not l.es_nota))::int
  from meses m
  left join lineas l on l.mes = m.mes
  group by m.mes
  order by m.mes;
end;
$$;

revoke all on function public.dashboard_ventas_mensuales(date, date) from public, anon;
grant execute on function public.dashboard_ventas_mensuales(date, date) to authenticated;

-- ============ dashboard_productos_salida ============
-- B2 + B3: por producto con movimiento de venta en el período. Margen =
-- ventas − costo (snapshot de la línea; devoluciones al costo de la línea).
-- `margen_pct` = margen / ventas (null sin ventas).
create or replace function public.dashboard_productos_salida(p_desde date, p_hasta date)
returns table (
  producto_id uuid,
  producto_nombre text,
  kg numeric,
  ventas_usd numeric,
  facturas int,
  precio_medio_usd_kg numeric,
  costo_usd numeric,
  margen_usd numeric,
  margen_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.dashboard_exigir_admin();

  return query
  select
    p.id,
    p.nombre,
    sum(l.kg),
    sum(l.venta_usd),
    (count(distinct l.factura_id) filter (where not l.es_nota))::int,
    sum(l.venta_usd) / nullif(sum(l.kg), 0),
    sum(l.costo_usd),
    sum(l.venta_usd) - sum(l.costo_usd),
    (sum(l.venta_usd) - sum(l.costo_usd)) / nullif(sum(l.venta_usd), 0)
  from public.dashboard_lineas_venta(p_desde, p_hasta) l
  join public.productos p on p.id = l.producto_id
  group by p.id, p.nombre
  having sum(l.kg) <> 0 or sum(l.venta_usd) <> 0
  order by sum(l.venta_usd) desc, p.nombre;
end;
$$;

revoke all on function public.dashboard_productos_salida(date, date) from public, anon;
grant execute on function public.dashboard_productos_salida(date, date) to authenticated;

-- ============ dashboard_spread_precio_costo ============
-- B5: por semana ISO (lunes) si el rango tiene ≤ 120 días; si no, por mes.
-- Solo líneas vendidas (las devoluciones no cambian el precio ni el costo
-- medio de lo vendido). Precio y costo medios ponderados por kg. Filtro
-- opcional por producto. Períodos sin ventas no se devuelven (el servicio
-- los rellena sin valor).
create or replace function public.dashboard_spread_precio_costo(
  p_desde date,
  p_hasta date,
  p_producto_id uuid default null
)
returns table (
  periodo date,
  granularidad text,
  kg numeric,
  precio_medio_usd_kg numeric,
  costo_medio_usd_kg numeric,
  spread_usd_kg numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_gran text := case when p_hasta - p_desde <= 120 then 'week' else 'month' end;
begin
  perform public.dashboard_exigir_admin();

  return query
  select
    date_trunc(v_gran, l.fecha)::date,
    case when v_gran = 'week' then 'semana' else 'mes' end,
    sum(l.kg),
    sum(l.venta_usd) / nullif(sum(l.kg), 0),
    sum(l.costo_usd) / nullif(sum(l.kg), 0),
    (sum(l.venta_usd) - sum(l.costo_usd)) / nullif(sum(l.kg), 0)
  from public.dashboard_lineas_venta(p_desde, p_hasta) l
  where not l.es_nota
    and (p_producto_id is null or l.producto_id = p_producto_id)
  group by 1, 2
  order by 1;
end;
$$;

revoke all on function public.dashboard_spread_precio_costo(date, date, uuid) from public, anon;
grant execute on function public.dashboard_spread_precio_costo(date, date, uuid) to authenticated;

-- ============ dashboard_mezcla_ventas ============
-- B9 + B10 + B11 en filas por grupo:
--   grupo 'total'     clave 'ventas'                 → usd netos, n.º facturas, kg (ticket)
--   grupo 'condicion' clave 'contado' | 'credito'     → usd netos, n.º facturas, kg
--   grupo 'metodo'    clave = pagos.metodo            → Σ monto_usd de cobros, n.º pagos
--   grupo 'moneda'    clave 'usd' | 'bs'              → Σ monto_usd de cobros, n.º pagos
-- Cobros: `pagos` con fecha en el período de facturas no anuladas.
create or replace function public.dashboard_mezcla_ventas(p_desde date, p_hasta date)
returns table (
  grupo text,
  clave text,
  usd numeric,
  cantidad int,
  kg numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.dashboard_exigir_admin();

  return query
  with lineas as (
    select * from public.dashboard_lineas_venta(p_desde, p_hasta)
  ),
  cobros as (
    select pg.metodo, pg.moneda_pago, pg.monto_usd
    from public.pagos pg
    join public.facturas f on f.id = pg.factura_id and f.estado <> 'anulada'
    where pg.fecha between p_desde and p_hasta
  )
  select 'total'::text, 'ventas'::text,
         coalesce(sum(l.venta_usd), 0),
         (count(distinct l.factura_id) filter (where not l.es_nota))::int,
         coalesce(sum(l.kg), 0)
  from lineas l
  union all
  select 'condicion', c.condicion,
         coalesce(sum(l.venta_usd), 0),
         (count(distinct l.factura_id) filter (where not l.es_nota))::int,
         coalesce(sum(l.kg), 0)
  from (values ('contado'), ('credito')) as c(condicion)
  left join lineas l on l.condicion = c.condicion
  group by c.condicion
  union all
  select 'metodo', c.metodo, sum(c.monto_usd), count(*)::int, null::numeric
  from cobros c
  group by c.metodo
  union all
  select 'moneda', c.moneda_pago, sum(c.monto_usd), count(*)::int, null::numeric
  from cobros c
  group by c.moneda_pago;
end;
$$;

revoke all on function public.dashboard_mezcla_ventas(date, date) from public, anon;
grant execute on function public.dashboard_mezcla_ventas(date, date) to authenticated;

-- ============ dashboard_top_clientes ============
-- B12: clientes por ventas netas del período (desc), los primeros
-- `p_limite`. `total_periodo_usd` y `clientes_periodo` (ventana sobre todos)
-- le permiten al servicio calcular el "Resto" y el Pareto acumulado.
create or replace function public.dashboard_top_clientes(
  p_desde date,
  p_hasta date,
  p_limite int default 10
)
returns table (
  cliente_id uuid,
  cliente_nombre text,
  ventas_usd numeric,
  facturas int,
  total_periodo_usd numeric,
  clientes_periodo int
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.dashboard_exigir_admin();
  if p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'p_limite fuera de rango (1–100)' using errcode = '22023';
  end if;

  return query
  with por_cliente as (
    select
      l.cliente_id,
      sum(l.venta_usd) as ventas,
      (count(distinct l.factura_id) filter (where not l.es_nota))::int as n
    from public.dashboard_lineas_venta(p_desde, p_hasta) l
    group by l.cliente_id
    having sum(l.venta_usd) <> 0
  )
  select
    pc.cliente_id,
    c.nombre,
    pc.ventas,
    pc.n,
    sum(pc.ventas) over (),
    (count(*) over ())::int
  from por_cliente pc
  join public.clientes c on c.id = pc.cliente_id
  order by pc.ventas desc, c.nombre
  limit p_limite;
end;
$$;

revoke all on function public.dashboard_top_clientes(date, date, int) from public, anon;
grant execute on function public.dashboard_top_clientes(date, date, int) to authenticated;

-- ============ dashboard_clientes_inactivos ============
-- C5: clientes activos con al menos una factura no anulada y cuya última
-- factura tiene más de `p_dias` días. `ventas_90d_usd`: ventas netas de los
-- 90 días que terminan en su última compra (lo que se está dejando de vender).
create or replace function public.dashboard_clientes_inactivos(p_dias int default 30)
returns table (
  cliente_id uuid,
  cliente_nombre text,
  ultima_compra date,
  dias int,
  ventas_90d_usd numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hoy date := public.dashboard_hoy();
begin
  perform public.dashboard_exigir_admin();
  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'p_dias fuera de rango (1–365)' using errcode = '22023';
  end if;

  return query
  with ultima as (
    select f.cliente_id, max(f.fecha) as fecha
    from public.facturas f
    where f.estado <> 'anulada'
    group by f.cliente_id
  )
  select
    c.id,
    c.nombre,
    u.fecha,
    (v_hoy - u.fecha)::int,
    coalesce((
      select sum(l.venta_usd)
      from public.dashboard_lineas_venta(u.fecha - 89, u.fecha) l
      where l.cliente_id = c.id
    ), 0)
  from ultima u
  join public.clientes c on c.id = u.cliente_id
  where c.activo
    and v_hoy - u.fecha > p_dias
  order by (v_hoy - u.fecha) asc, c.nombre;
end;
$$;

revoke all on function public.dashboard_clientes_inactivos(int) from public, anon;
grant execute on function public.dashboard_clientes_inactivos(int) to authenticated;

-- ============ dashboard_resultado_cambiario ============
-- B4 / D5: en Bs, por separado:
--   cobros_bs     = Σ pagos.ganancia_cambiaria_bs (cobros del período)
--   pagos_prov_bs = Σ pagos_proveedores.ganancia_cambiaria_bs (misma fórmula
--                   de `creditService.gananciaCambiariaBs`: positivo = mayor
--                   desembolso en Bs)
--   neto_bs       = cobros − pagos a proveedores
-- Nunca se suma al margen bruto USD.
create or replace function public.dashboard_resultado_cambiario(p_desde date, p_hasta date)
returns table (
  cobros_bs numeric,
  cobros int,
  pagos_proveedores_bs numeric,
  pagos_proveedores int,
  neto_bs numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.dashboard_exigir_admin();

  return query
  with c as (
    select coalesce(sum(pg.ganancia_cambiaria_bs), 0) as bs, count(*)::int as n
    from public.pagos pg
    join public.facturas f on f.id = pg.factura_id and f.estado <> 'anulada'
    where pg.fecha between p_desde and p_hasta
  ),
  p as (
    select coalesce(sum(pp.ganancia_cambiaria_bs), 0) as bs, count(*)::int as n
    from public.pagos_proveedores pp
    join public.compras co on co.id = pp.compra_id and co.estado <> 'anulada'
    where pp.fecha between p_desde and p_hasta
  )
  select c.bs, c.n, p.bs, p.n, c.bs - p.bs
  from c, p;
end;
$$;

revoke all on function public.dashboard_resultado_cambiario(date, date) from public, anon;
grant execute on function public.dashboard_resultado_cambiario(date, date) to authenticated;
