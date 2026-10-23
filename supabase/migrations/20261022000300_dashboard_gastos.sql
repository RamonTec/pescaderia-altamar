-- 20-gastos (Fase D): RPCs de gastos y pendientes para el dashboard (15).
--
-- Solo admin: ambas llaman a `dashboard_exigir_admin()` (42501 al operador).
-- Gastos confirmados del período por categoría (primer nivel y subcategoría).
-- Pendientes hasta hoy (n y USD estimado de los que estén en USD).
-- Ninguna RPC existente de 15 se modifica.

-- ============ dashboard_gastos ============
create or replace function public.dashboard_gastos(
  p_desde date,
  p_hasta date
)
returns table (
  categoria_id uuid,
  categoria text,
  es_sistema boolean,
  subcategoria_id uuid,
  subcategoria text,
  total_usd numeric,
  n_gastos int
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
  with base as (
    select
      coalesce(padre.id, c.id) as cat_id,
      coalesce(padre.nombre, c.nombre) as cat_nombre,
      coalesce(padre.es_sistema, c.es_sistema) as cat_es_sistema,
      case when c.categoria_padre_id is not null then c.id else null end as sub_id,
      case when c.categoria_padre_id is not null then c.nombre else null end as sub_nombre,
      g.monto_usd
    from public.gastos g
    join public.categorias_gasto c on c.id = g.categoria_id
    left join public.categorias_gasto padre on padre.id = c.categoria_padre_id
    where g.estado = 'confirmado'
      and g.fecha between p_desde and p_hasta
  )
  select
    b.cat_id as categoria_id,
    b.cat_nombre as categoria,
    b.cat_es_sistema as es_sistema,
    b.sub_id as subcategoria_id,
    b.sub_nombre as subcategoria,
    coalesce(round(sum(b.monto_usd), 6), 0)::numeric(14,6) as total_usd,
    count(*)::int as n_gastos
  from base b
  group by
    b.cat_id,
    b.cat_nombre,
    b.cat_es_sistema,
    b.sub_id,
    b.sub_nombre
  order by total_usd desc, categoria, subcategoria nulls first;
end;
$$;

comment on function public.dashboard_gastos(date, date) is
  'Gastos confirmados en el rango por categoría de primer nivel y subcategoría (20-gastos, Fase D). Solo admin.';

revoke all on function public.dashboard_gastos(date, date) from public, anon;
grant execute on function public.dashboard_gastos(date, date) to authenticated;

-- ============ dashboard_gastos_pendientes ============
create or replace function public.dashboard_gastos_pendientes()
returns table (
  n int,
  monto_usd_estimado numeric
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
    count(*)::int as n,
    round(sum(g.monto) filter (where g.moneda = 'usd'), 6)::numeric(14,6) as monto_usd_estimado
  from public.gastos g
  where g.estado = 'pendiente'
    and g.fecha <= v_hoy;
end;
$$;

comment on function public.dashboard_gastos_pendientes() is
  'Cantidad y monto USD estimado de gastos pendientes de confirmar hasta hoy (20-gastos, Fase D). Solo admin.';

revoke all on function public.dashboard_gastos_pendientes() from public, anon;
grant execute on function public.dashboard_gastos_pendientes() to authenticated;
