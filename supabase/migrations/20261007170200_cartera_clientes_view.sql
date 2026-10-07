-- 09-cuentas-por-cobrar (3/3): resumen de cartera por cliente.
--
-- Una fila por cliente (una sola consulta para el listado, sin N+1):
-- conteos por estado de cobro, saldo y saldo vencido (null si no es admin,
-- patrón de 0003), días de la vencida más antigua y último recordatorio
-- (no fallido).
--
-- REGLA DE REFERENCIA: `src/lib/cartera/estado.ts` (`estadoCartera`). Esta
-- vista la replica; si cambia una, cambiar la otra:
--   saldo = total − pagado − notas de crédito emitidas
--   anulada   si la factura está anulada
--   pagada    si saldo ≤ 0,005
--   vencida   si hoy > fecha_vencimiento
--   por_vencer si vence en ≤ config_negocio.dias_aviso_por_vencer días
--   pendiente en otro caso
-- "Hoy" es la fecha de Venezuela (America/Caracas), igual que `fechaHoy()`.
--
-- security definer (default), como las vistas de 0003: lee las tablas con
-- los privilegios del dueño y `es_admin()` se evalúa con el JWT del invocador.

create or replace view public.cartera_clientes_view
as
with params as (
  select
    (now() at time zone 'America/Caracas')::date as hoy,
    coalesce(
      (select c.dias_aviso_por_vencer from public.config_negocio c where c.id = 1),
      3
    ) as dias_aviso
),
creditos as (
  select nc.factura_id, sum(nc.total_usd) as creditos_usd
  from public.notas_credito nc
  where nc.estado = 'emitida'
  group by nc.factura_id
),
docs as (
  select
    f.cliente_id,
    f.fecha_vencimiento,
    p.hoy,
    f.total_usd - f.pagado_usd - coalesce(cr.creditos_usd, 0) as saldo_usd,
    case
      when f.estado = 'anulada' then 'anulada'
      when f.total_usd - f.pagado_usd - coalesce(cr.creditos_usd, 0) <= 0.005 then 'pagada'
      when p.hoy > f.fecha_vencimiento then 'vencida'
      when f.fecha_vencimiento - p.hoy <= p.dias_aviso then 'por_vencer'
      else 'pendiente'
    end as estado_cartera
  from public.facturas f
  cross join params p
  left join creditos cr on cr.factura_id = f.id
),
agg as (
  select
    d.cliente_id,
    count(*) filter (where d.estado_cartera = 'pagada')::int as pagadas,
    count(*) filter (where d.estado_cartera = 'pendiente')::int as pendientes,
    count(*) filter (where d.estado_cartera = 'por_vencer')::int as por_vencer,
    count(*) filter (where d.estado_cartera = 'vencida')::int as vencidas,
    count(*) filter (where d.estado_cartera = 'anulada')::int as anuladas,
    coalesce(sum(d.saldo_usd) filter (
      where d.estado_cartera in ('pendiente', 'por_vencer', 'vencida')
    ), 0) as saldo_usd,
    coalesce(sum(d.saldo_usd) filter (where d.estado_cartera = 'vencida'), 0)
      as saldo_vencido_usd,
    max(d.hoy - d.fecha_vencimiento) filter (where d.estado_cartera = 'vencida')
      as vencida_mas_antigua_dias
  from docs d
  group by d.cliente_id
),
ultimo as (
  select distinct on (r.cliente_id)
    r.cliente_id, r.created_at, r.canal
  from public.recordatorios_cobro r
  where r.estado <> 'fallido'
  order by r.cliente_id, r.created_at desc
)
select
  c.id as cliente_id,
  coalesce(a.pagadas, 0) as pagadas,
  coalesce(a.pendientes, 0) as pendientes,
  coalesce(a.por_vencer, 0) as por_vencer,
  coalesce(a.vencidas, 0) as vencidas,
  coalesce(a.anuladas, 0) as anuladas,
  case when public.es_admin() then coalesce(a.saldo_usd, 0) else null end as saldo_usd,
  case when public.es_admin() then coalesce(a.saldo_vencido_usd, 0) else null end
    as saldo_vencido_usd,
  a.vencida_mas_antigua_dias,
  u.created_at as ultimo_recordatorio_fecha,
  u.canal as ultimo_recordatorio_canal
from public.clientes c
left join agg a on a.cliente_id = c.id
left join ultimo u on u.cliente_id = c.id;

grant select on public.cartera_clientes_view to authenticated;
