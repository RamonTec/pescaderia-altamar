-- 15-dashboard (2/5): bloques operativos (cualquier autenticado).
--
-- Devuelven kg, conteos y listas. Los únicos importes (USD estimado de un
-- pedido y USD por tramo de antigüedad) salen `null` si `not es_admin()`,
-- patrón de 0003. Nunca devuelven costos.
--
-- Criterios iguales a `/inventario` (07-lotes), por precedente:
--   - stock de un producto = Σ stock de sus lotes `abierto` con stock > 0
--     (productos activos con `controla_stock`); "stock bajo" si
--     stock ≤ `umbral_stock_bajo_kg` (`valorizarLotes`); sin umbral, la
--     alerta no aplica (lista vacía, umbral `null`).
--   - lote "antiguo": abierto con stock y días en cava ≥ `dias_alerta_lote`
--     (`esAntiguo` de `src/lib/lotes.ts`, el mismo que pinta el chip
--     "Antiguo"); sin `dias_alerta_lote`, lista vacía.
--
-- `dashboard_operativo()` devuelve una fila con tres listas (jsonb) para
-- resolver la fila operativa en una sola llamada; cada lista tiene su tipo
-- en `src/types/domain.ts` (`DashboardOperativo`).

-- ============ dashboard_operativo ============
create or replace function public.dashboard_operativo()
returns table (
  hoy date,
  umbral_stock_bajo_kg numeric,
  dias_alerta_lote int,
  pedidos jsonb,
  stock_bajo jsonb,
  lotes_antiguos jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hoy date := public.dashboard_hoy();
  v_admin boolean := public.es_admin();
  v_umbral numeric;
  v_dias_alerta int;
begin
  select c.umbral_stock_bajo_kg, c.dias_alerta_lote
    into v_umbral, v_dias_alerta
  from public.config_negocio c
  where c.id = 1;

  return query
  with stock_lotes as (
    select l.id, l.codigo, l.producto_id, l.fecha_ingreso,
           coalesce(sum(m.peso_kg), 0) as stock_kg
    from public.lotes l
    left join public.movimientos m on m.lote_id = l.id
    where l.estado = 'abierto'
    group by l.id
  ),
  ped as (
    select
      pe.id,
      pe.cliente_id,
      cl.nombre as cliente_nombre,
      pe.fecha_entrega,
      case
        when pe.fecha_entrega < v_hoy then 'atrasado'
        when pe.fecha_entrega = v_hoy then 'hoy'
        else 'manana'
      end as grupo,
      count(pi.id)::int as items,
      coalesce(sum(pi.peso_estimado_kg), 0) as kg_estimados,
      case when v_admin
        then coalesce(sum(pi.peso_estimado_kg * pi.precio_usd_kg), 0)
        else null
      end as usd_estimado
    from public.pedidos pe
    join public.clientes cl on cl.id = pe.cliente_id
    left join public.pedido_items pi on pi.pedido_id = pe.id
    where pe.estado = 'pendiente'
      and pe.fecha_entrega is not null
      and pe.fecha_entrega <= v_hoy + 1
    group by pe.id, cl.nombre
  ),
  bajo as (
    select p.id as producto_id, p.nombre as producto_nombre,
           coalesce(sum(sl.stock_kg) filter (where sl.stock_kg > 0), 0) as stock_kg
    from public.productos p
    left join stock_lotes sl on sl.producto_id = p.id
    where p.activo and p.controla_stock and v_umbral is not null
    group by p.id
    having coalesce(sum(sl.stock_kg) filter (where sl.stock_kg > 0), 0) <= v_umbral
  ),
  antiguos as (
    select sl.id as lote_id, sl.codigo, sl.producto_id, p.nombre as producto_nombre,
           sl.fecha_ingreso, (v_hoy - sl.fecha_ingreso) as dias, sl.stock_kg
    from stock_lotes sl
    join public.productos p on p.id = sl.producto_id
    where sl.stock_kg > 0
      and v_dias_alerta is not null
      and (v_hoy - sl.fecha_ingreso) >= v_dias_alerta
  )
  select
    v_hoy,
    v_umbral,
    v_dias_alerta,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'pedido_id', x.id,
        'cliente_id', x.cliente_id,
        'cliente_nombre', x.cliente_nombre,
        'fecha_entrega', x.fecha_entrega,
        'grupo', x.grupo,
        'items', x.items,
        'kg_estimados', x.kg_estimados,
        'usd_estimado', x.usd_estimado
      ) order by x.fecha_entrega, x.cliente_nombre)
      from ped x
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'producto_id', b.producto_id,
        'producto_nombre', b.producto_nombre,
        'stock_kg', b.stock_kg
      ) order by b.stock_kg, b.producto_nombre)
      from bajo b
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'lote_id', a.lote_id,
        'codigo', a.codigo,
        'producto_id', a.producto_id,
        'producto_nombre', a.producto_nombre,
        'fecha_ingreso', a.fecha_ingreso,
        'dias', a.dias,
        'stock_kg', a.stock_kg
      ) order by a.dias desc, a.codigo)
      from antiguos a
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.dashboard_operativo() from public, anon;
grant execute on function public.dashboard_operativo() to authenticated;

-- ============ dashboard_antiguedad_lotes ============
-- Lotes `abierto` con stock > 0 por días en cava desde `fecha_ingreso`, en
-- tramos fijos (D3): 0–2, 3–5 y > 5 días. Siempre tres filas. `usd` =
-- Σ stock × costo del lote, `null` para el operador.
create or replace function public.dashboard_antiguedad_lotes()
returns table (
  tramo text,
  orden int,
  lotes int,
  kg numeric,
  usd numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hoy date := public.dashboard_hoy();
  v_admin boolean := public.es_admin();
begin
  return query
  with stock_lotes as (
    select l.id, l.fecha_ingreso, l.costo_usd_kg,
           coalesce(sum(m.peso_kg), 0) as stock_kg
    from public.lotes l
    left join public.movimientos m on m.lote_id = l.id
    where l.estado = 'abierto'
    group by l.id
  ),
  clasificados as (
    select
      case
        when v_hoy - sl.fecha_ingreso <= 2 then '0-2'
        when v_hoy - sl.fecha_ingreso <= 5 then '3-5'
        else '>5'
      end as tramo,
      sl.stock_kg,
      sl.stock_kg * sl.costo_usd_kg as valor
    from stock_lotes sl
    where sl.stock_kg > 0
  ),
  tramos(tramo, orden) as (
    values ('0-2', 1), ('3-5', 2), ('>5', 3)
  )
  select
    t.tramo,
    t.orden,
    count(c.tramo)::int,
    coalesce(sum(c.stock_kg), 0),
    case when v_admin then coalesce(sum(c.valor), 0) else null end
  from tramos t
  left join clasificados c on c.tramo = t.tramo
  group by t.tramo, t.orden
  order by t.orden;
end;
$$;

revoke all on function public.dashboard_antiguedad_lotes() from public, anon;
grant execute on function public.dashboard_antiguedad_lotes() to authenticated;
