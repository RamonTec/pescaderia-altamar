-- 15-dashboard (5/5): cartera, flujo, riesgo y contratos (solo admin).
--
-- Foto a hoy (America/Caracas), no dependen del rango. Todas exigen
-- `es_admin()` (`42501` si no). Saldos de facturas de
-- `dashboard_facturas_saldo_view` y de compras de
-- `dashboard_compras_saldo_view` (vencimiento derivado de D2), ambas en 1/5.
-- Sin `alter table` sobre `compras`.

-- ============ dashboard_aging_cartera ============
-- C1: facturas con saldo > 0,005 por tramo. Siempre cuatro filas.
--   por_vencer  no vencida (hoy ≤ fecha_vencimiento)
--   1-15 / 16-30 / >30  días de vencida
-- Σ tramos = `cxc_saldo_usd` de `dashboard_kpis_dia()`.
create or replace function public.dashboard_aging_cartera()
returns table (
  tramo text,
  orden int,
  saldo_usd numeric,
  facturas int
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
  with tramos(tramo, orden) as (
    values ('por_vencer', 1), ('1-15', 2), ('16-30', 3), ('>30', 4)
  ),
  docs as (
    select
      case
        when not s.vencida then 'por_vencer'
        when s.dias_vencida <= 15 then '1-15'
        when s.dias_vencida <= 30 then '16-30'
        else '>30'
      end as tramo,
      s.saldo_usd
    from public.dashboard_facturas_saldo_view s
    where s.saldo_usd > 0.005
  )
  select t.tramo, t.orden, coalesce(sum(d.saldo_usd), 0), count(d.tramo)::int
  from tramos t
  left join docs d on d.tramo = t.tramo
  group by t.tramo, t.orden
  order by t.orden;
end;
$$;

revoke all on function public.dashboard_aging_cartera() from public, anon;
grant execute on function public.dashboard_aging_cartera() to authenticated;

-- ============ dashboard_top_deudores ============
-- C2: clientes por saldo desc. Mismo saldo y vencido que `cartera_clientes_view`.
create or replace function public.dashboard_top_deudores(p_limite int default 10)
returns table (
  cliente_id uuid,
  cliente_nombre text,
  saldo_usd numeric,
  vencido_usd numeric,
  facturas int,
  vencida_mas_antigua_dias int
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
  select
    c.id,
    c.nombre,
    sum(s.saldo_usd),
    coalesce(sum(s.saldo_usd) filter (where s.vencida), 0),
    count(*)::int,
    (max(s.dias_vencida) filter (where s.vencida))::int
  from public.dashboard_facturas_saldo_view s
  join public.clientes c on c.id = s.cliente_id
  where s.saldo_usd > 0.005
  group by c.id, c.nombre
  order by sum(s.saldo_usd) desc, c.nombre
  limit p_limite;
end;
$$;

revoke all on function public.dashboard_top_deudores(int) from public, anon;
grant execute on function public.dashboard_top_deudores(int) to authenticated;

-- ============ dashboard_flujo_proyectado ============
-- C3: `p_dias` ∈ {7, 30} (si no, `22023`). Una fila `dia` por cada día de
-- hoy a hoy + p_dias − 1: cobros esperados = saldos de facturas que vencen
-- ese día; pagos esperados = saldos de compras a crédito que vencen ese día
-- (D2). Una fila `vencido` (fecha null) con lo ya vencido sin cobrar / sin
-- pagar, que no se reparte en días. El acumulado lo calcula el servicio.
create or replace function public.dashboard_flujo_proyectado(p_dias int)
returns table (
  tipo text,
  fecha date,
  cobros_usd numeric,
  pagos_usd numeric
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
  if p_dias is null or p_dias not in (7, 30) then
    raise exception 'p_dias debe ser 7 o 30' using errcode = '22023';
  end if;

  return query
  with dias as (
    select generate_series(v_hoy, v_hoy + (p_dias - 1), interval '1 day')::date as fecha
  ),
  cobros as (
    select s.fecha_vencimiento as fecha, sum(s.saldo_usd) as usd
    from public.dashboard_facturas_saldo_view s
    where s.saldo_usd > 0.005 and not s.vencida
    group by s.fecha_vencimiento
  ),
  pagos as (
    select c.fecha_vencimiento as fecha, sum(c.saldo_usd) as usd
    from public.dashboard_compras_saldo_view c
    where c.saldo_usd > 0.005 and not c.vencida
    group by c.fecha_vencimiento
  )
  select 'vencido'::text, null::date,
    coalesce((
      select sum(s.saldo_usd) from public.dashboard_facturas_saldo_view s
      where s.saldo_usd > 0.005 and s.vencida
    ), 0),
    coalesce((
      select sum(c.saldo_usd) from public.dashboard_compras_saldo_view c
      where c.saldo_usd > 0.005 and c.vencida
    ), 0)
  union all
  select 'dia', d.fecha, coalesce(co.usd, 0), coalesce(pa.usd, 0)
  from dias d
  left join cobros co on co.fecha = d.fecha
  left join pagos pa on pa.fecha = d.fecha
  order by 1 desc, 2;
end;
$$;

revoke all on function public.dashboard_flujo_proyectado(int) from public, anon;
grant execute on function public.dashboard_flujo_proyectado(int) to authenticated;

-- ============ dashboard_exposicion_cambiaria ============
-- C4 / D7, informativos y en Bs:
--   a) brecha BCV/paralela sobre el saldo CxC: brecha_bs = saldo × (paralela − bcv),
--      brecha_pct = paralela / bcv − 1 (vigentes de hoy, USD).
--   b) resultado latente: Σ saldo × (tasa_vigente − tasa_snapshot) por factura,
--      con la vigente de `config_negocio.fuente_tasa_default` (la misma fuente
--      con que se convierte a Bs en `/inventario`).
-- Sin tasa disponible, los valores que dependen de ella salen `null`.
create or replace function public.dashboard_exposicion_cambiaria()
returns table (
  saldo_usd numeric,
  fuente text,
  tasa_bcv numeric,
  tasa_bcv_fecha date,
  tasa_paralela numeric,
  tasa_paralela_fecha date,
  brecha_pct numeric,
  brecha_bs numeric,
  latente_bs numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hoy date := public.dashboard_hoy();
  v_bcv public.tasas;
  v_par public.tasas;
  v_fuente text;
  v_tasa numeric;
  v_saldo numeric;
begin
  perform public.dashboard_exigir_admin();

  v_bcv := public.tasa_vigente(v_hoy, 'bcv', 'USD');
  v_par := public.tasa_vigente(v_hoy, 'paralela', 'USD');
  select coalesce(c.fuente_tasa_default, 'bcv') into v_fuente
  from public.config_negocio c where c.id = 1;
  v_fuente := coalesce(v_fuente, 'bcv');
  v_tasa := case when v_fuente = 'paralela' then v_par.valor_bs else v_bcv.valor_bs end;

  select coalesce(sum(s.saldo_usd), 0) into v_saldo
  from public.dashboard_facturas_saldo_view s
  where s.saldo_usd > 0.005;

  return query
  select
    v_saldo,
    v_fuente,
    v_bcv.valor_bs,
    v_bcv.fecha,
    v_par.valor_bs,
    v_par.fecha,
    case when v_bcv.valor_bs is not null and v_par.valor_bs is not null
      then v_par.valor_bs / v_bcv.valor_bs - 1 end,
    case when v_bcv.valor_bs is not null and v_par.valor_bs is not null
      then v_saldo * (v_par.valor_bs - v_bcv.valor_bs) end,
    case when v_tasa is not null then (
      select coalesce(sum(s.saldo_usd * (v_tasa - s.tasa_snapshot)), 0)
      from public.dashboard_facturas_saldo_view s
      where s.saldo_usd > 0.005
    ) end;
end;
$$;

revoke all on function public.dashboard_exposicion_cambiaria() from public, anon;
grant execute on function public.dashboard_exposicion_cambiaria() to authenticated;

-- ============ dashboard_contratos_sin_firmar ============
-- D4 (agregado 14): contratos `generado` o `enviado`. Contraparte = cliente
-- de la factura (venta) o proveedor de la compra (compra).
create or replace function public.dashboard_contratos_sin_firmar()
returns table (
  contrato_id uuid,
  numero bigint,
  tipo text,
  estado text,
  contraparte_nombre text,
  fecha date,
  fecha_vencimiento date,
  dias_desde_generado int
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
  select
    ct.id,
    ct.numero,
    ct.tipo,
    ct.estado,
    coalesce(cl.nombre, pv.nombre),
    ct.fecha,
    ct.fecha_vencimiento,
    (v_hoy - (ct.created_at at time zone 'America/Caracas')::date)::int
  from public.contratos ct
  left join public.facturas f on f.id = ct.factura_id
  left join public.clientes cl on cl.id = f.cliente_id
  left join public.compras co on co.id = ct.compra_id
  left join public.proveedores pv on pv.id = co.proveedor_id
  where ct.estado in ('generado', 'enviado')
  order by ct.created_at asc;
end;
$$;

revoke all on function public.dashboard_contratos_sin_firmar() from public, anon;
grant execute on function public.dashboard_contratos_sin_firmar() to authenticated;
