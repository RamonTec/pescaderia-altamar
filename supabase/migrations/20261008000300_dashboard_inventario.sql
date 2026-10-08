-- 15-dashboard (4/5): procesos, pérdidas y valor del inventario (solo admin).
--
-- Todas exigen `es_admin()` (`42501` si no). Reglas de §4.3:
--   merma = entrada − salida; rendimiento = salida / entrada; el costo total
--   de la entrada pasa a la salida → costo kg limpio = costo_total / salida.
-- Costo de la merma = merma_kg × costo_usd_kg del lote origen
-- (`proceso_items.lote_origen_id`).

-- ============ dashboard_merma_procesos ============
-- B6: por producto de origen, procesamientos con fecha en el período.
create or replace function public.dashboard_merma_procesos(p_desde date, p_hasta date)
returns table (
  producto_id uuid,
  producto_nombre text,
  procesos int,
  kg_entrada numeric,
  kg_salida numeric,
  merma_kg numeric,
  merma_pct numeric,
  rendimiento numeric,
  costo_merma_usd numeric
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
    (count(distinct pr.id))::int,
    sum(pi.peso_entrada_kg),
    sum(pi.peso_salida_kg),
    sum(pi.peso_entrada_kg - pi.peso_salida_kg),
    sum(pi.peso_entrada_kg - pi.peso_salida_kg) / nullif(sum(pi.peso_entrada_kg), 0),
    sum(pi.peso_salida_kg) / nullif(sum(pi.peso_entrada_kg), 0),
    sum((pi.peso_entrada_kg - pi.peso_salida_kg) * l.costo_usd_kg)
  from public.procesamientos pr
  join public.proceso_items pi on pi.procesamiento_id = pr.id
  join public.lotes l on l.id = pi.lote_origen_id
  join public.productos p on p.id = pi.producto_origen_id
  where pr.fecha between p_desde and p_hasta
  group by p.id, p.nombre
  order by sum(pi.peso_entrada_kg - pi.peso_salida_kg) desc, p.nombre;
end;
$$;

revoke all on function public.dashboard_merma_procesos(date, date) from public, anon;
grant execute on function public.dashboard_merma_procesos(date, date) to authenticated;

-- ============ dashboard_rendimiento_proveedor ============
-- B7: por proveedor del lote origen (`lotes.proveedor_id`; un lote procesado
-- hereda el de su padre) y producto de origen. Costo kg crudo medio =
-- Σ(entrada × costo del lote) / Σ entrada; costo real del kg limpio =
-- Σ costo_total_usd / Σ peso_salida_kg.
create or replace function public.dashboard_rendimiento_proveedor(p_desde date, p_hasta date)
returns table (
  proveedor_id uuid,
  proveedor_nombre text,
  producto_id uuid,
  producto_nombre text,
  procesos int,
  kg_entrada numeric,
  kg_salida numeric,
  rendimiento numeric,
  merma_pct numeric,
  costo_kg_crudo_usd numeric,
  costo_kg_limpio_usd numeric
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
    pv.id,
    pv.nombre,
    p.id,
    p.nombre,
    (count(distinct pr.id))::int,
    sum(pi.peso_entrada_kg),
    sum(pi.peso_salida_kg),
    sum(pi.peso_salida_kg) / nullif(sum(pi.peso_entrada_kg), 0),
    sum(pi.peso_entrada_kg - pi.peso_salida_kg) / nullif(sum(pi.peso_entrada_kg), 0),
    sum(pi.peso_entrada_kg * l.costo_usd_kg) / nullif(sum(pi.peso_entrada_kg), 0),
    sum(pi.costo_total_usd) / nullif(sum(pi.peso_salida_kg), 0)
  from public.procesamientos pr
  join public.proceso_items pi on pi.procesamiento_id = pr.id
  join public.lotes l on l.id = pi.lote_origen_id
  join public.productos p on p.id = pi.producto_origen_id
  left join public.proveedores pv on pv.id = l.proveedor_id
  where pr.fecha between p_desde and p_hasta
  group by pv.id, pv.nombre, p.id, p.nombre
  order by pv.nombre nulls last, p.nombre;
end;
$$;

revoke all on function public.dashboard_rendimiento_proveedor(date, date) from public, anon;
grant execute on function public.dashboard_rendimiento_proveedor(date, date) to authenticated;

-- ============ dashboard_perdidas_motivo ============
-- B8: `perdidas_lote` del período por motivo (los cinco, incluido `cierre`,
-- siempre presentes), kg y USD al costo del lote.
create or replace function public.dashboard_perdidas_motivo(p_desde date, p_hasta date)
returns table (
  motivo text,
  registros int,
  kg numeric,
  usd numeric
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
  with motivos(motivo, orden) as (
    values ('danado', 1), ('vencido', 2), ('faltante', 3), ('cierre', 4), ('otro', 5)
  ),
  perdidas as (
    select pl.motivo, pl.peso_kg, pl.peso_kg * l.costo_usd_kg as usd
    from public.perdidas_lote pl
    join public.lotes l on l.id = pl.lote_id
    where pl.fecha between p_desde and p_hasta
  )
  select
    m.motivo,
    count(x.motivo)::int,
    coalesce(sum(x.peso_kg), 0),
    coalesce(sum(x.usd), 0)
  from motivos m
  left join perdidas x on x.motivo = m.motivo
  group by m.motivo, m.orden
  order by m.orden;
end;
$$;

revoke all on function public.dashboard_perdidas_motivo(date, date) from public, anon;
grant execute on function public.dashboard_perdidas_motivo(date, date) to authenticated;

-- ============ dashboard_valor_inventario ============
-- D2 (desglose): por producto activo, Σ stock × costo de sus lotes `abierto`
-- con stock > 0 (mismo criterio que `/inventario`). Orden por valor desc; el
-- servicio toma los primeros 10 y agrupa el resto.
create or replace function public.dashboard_valor_inventario()
returns table (
  producto_id uuid,
  producto_nombre text,
  lotes int,
  stock_kg numeric,
  valor_usd numeric
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
  with stock_lotes as (
    select l.id, l.producto_id, l.costo_usd_kg, sum(m.peso_kg) as stock_kg
    from public.lotes l
    join public.movimientos m on m.lote_id = l.id
    where l.estado = 'abierto'
    group by l.id
    having sum(m.peso_kg) > 0
  )
  select
    p.id,
    p.nombre,
    count(*)::int,
    sum(sl.stock_kg),
    sum(sl.stock_kg * sl.costo_usd_kg)
  from stock_lotes sl
  join public.productos p on p.id = sl.producto_id and p.activo
  group by p.id, p.nombre
  order by sum(sl.stock_kg * sl.costo_usd_kg) desc, p.nombre;
end;
$$;

revoke all on function public.dashboard_valor_inventario() from public, anon;
grant execute on function public.dashboard_valor_inventario() to authenticated;
