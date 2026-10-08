-- 15-dashboard (1/5): base del dashboard.
--
-- Sin tablas nuevas. Piezas internas que usan las funciones `dashboard_*`
-- (security definer); ninguna es legible ni ejecutable por `authenticated`:
--
-- - `dashboard_hoy()`: "hoy" en Venezuela (America/Caracas), igual que
--   `fechaHoy()` de `src/lib/format.ts` y `cartera_clientes_view`.
-- - `dashboard_exigir_admin()`: lanza `42501` si `not es_admin()`. Las RPC de
--   importes la llaman primero: fallan, no devuelven ceros silenciosos.
-- - `dashboard_facturas_saldo_view`: saldo por factura no anulada.
-- - `dashboard_compras_saldo_view`: saldo y vencimiento derivado (D2) de las
--   compras a crédito abiertas. Es la "CTE compartida" que admite la tarea 5
--   en lugar de `dashboard_vencimiento_compra(compra_id)`: una vista evita una
--   llamada por fila y la usan `dashboard_kpis_dia()` (3/5) y
--   `dashboard_flujo_proyectado()` (5/5); se crea aquí para que ambas
--   migraciones la encuentren.
-- - `dashboard_lineas_venta(desde, hasta)`: líneas de venta netas de notas de
--   crédito (D4), base de ventas, kg y margen.
-- - Índices de fecha para los filtros por período.

-- ============ dashboard_hoy ============
create or replace function public.dashboard_hoy()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Caracas')::date
$$;

revoke all on function public.dashboard_hoy() from public, anon, authenticated;

-- ============ dashboard_exigir_admin ============
create or replace function public.dashboard_exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede ver este indicador'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.dashboard_exigir_admin() from public, anon, authenticated;

-- ============ dashboard_facturas_saldo_view ============
-- REGLA DE REFERENCIA: `src/lib/cartera/estado.ts` (`estadoCartera`) y
-- `cartera_clientes_view` (20261007170200). Si cambia una, cambiar las otras:
--   saldo   = total − pagado − Σ notas de crédito emitidas
--   vencida si hoy > fecha_vencimiento (hoy = America/Caracas)
-- Solo facturas no anuladas. Un saldo ≤ 0,005 es "pagada": las funciones que
-- suman cartera filtran `saldo_usd > 0.005`, igual que la vista de cartera
-- (que suma los estados pendiente, por_vencer y vencida).
--
-- Comprobación (debe devolver 0 filas, ejecutada como admin):
--   select c.cliente_id, c.saldo_usd, coalesce(d.saldo, 0) as dashboard
--   from public.cartera_clientes_view c
--   left join (
--     select cliente_id, sum(saldo_usd) as saldo
--     from public.dashboard_facturas_saldo_view
--     where saldo_usd > 0.005
--     group by cliente_id
--   ) d on d.cliente_id = c.cliente_id
--   where abs(c.saldo_usd - coalesce(d.saldo, 0)) > 0.000001;
--
-- "Hoy" va en línea (no `dashboard_hoy()`): una vista evalúa sus funciones
-- con los privilegios de quien la consulta.
create or replace view public.dashboard_facturas_saldo_view
as
with creditos as (
  select nc.factura_id, sum(nc.total_usd) as creditos_usd
  from public.notas_credito nc
  where nc.estado = 'emitida'
  group by nc.factura_id
),
params as (
  select (now() at time zone 'America/Caracas')::date as hoy
)
select
  f.id as factura_id,
  f.numero,
  f.cliente_id,
  f.fecha,
  f.condicion,
  f.fecha_vencimiento,
  f.tasa_snapshot,
  f.total_usd,
  f.pagado_usd,
  coalesce(cr.creditos_usd, 0) as creditos_usd,
  f.total_usd - f.pagado_usd - coalesce(cr.creditos_usd, 0) as saldo_usd,
  p.hoy > f.fecha_vencimiento as vencida,
  greatest(p.hoy - f.fecha_vencimiento, 0) as dias_vencida
from public.facturas f
cross join params p
left join creditos cr on cr.factura_id = f.id
where f.estado <> 'anulada';

revoke all on public.dashboard_facturas_saldo_view from public, anon, authenticated;

-- ============ dashboard_compras_saldo_view ============
-- Cuentas por pagar: compras a crédito `abierta`, saldo = subtotal − pagado
-- (misma regla que `proveedorBalanceService`). Vencimiento (D2, sin cambiar
-- el esquema de `compras`): `contratos.fecha_vencimiento` del contrato
-- `compra_credito` activo (estado ≠ anulado; hay a lo sumo uno por el índice
-- `contratos_compra_activo_uq`); si no hay contrato,
-- `compras.fecha + config_negocio.dias_credito_default`.
-- Cuando exista `compras.fecha_vencimiento` (futuro módulo de cuentas por
-- pagar), reemplazar aquí la regla (anotado en specs/15-dashboard/tasks.md).
create or replace view public.dashboard_compras_saldo_view
as
with params as (
  select
    (now() at time zone 'America/Caracas')::date as hoy,
    coalesce(
      (select c.dias_credito_default from public.config_negocio c where c.id = 1),
      15
    ) as dias_credito_default
),
base as (
  select
    co.id as compra_id,
    co.proveedor_id,
    co.fecha,
    co.subtotal_usd - co.pagado_usd as saldo_usd,
    coalesce(ct.fecha_vencimiento, co.fecha + p.dias_credito_default) as fecha_vencimiento,
    ct.id is not null as con_contrato,
    p.hoy
  from public.compras co
  cross join params p
  left join public.contratos ct
    on ct.compra_id = co.id
   and ct.tipo = 'compra_credito'
   and ct.estado <> 'anulado'
  where co.condicion = 'credito'
    and co.estado = 'abierta'
)
select
  b.compra_id,
  b.proveedor_id,
  b.fecha,
  b.saldo_usd,
  b.fecha_vencimiento,
  b.con_contrato,
  b.hoy > b.fecha_vencimiento as vencida,
  greatest(b.hoy - b.fecha_vencimiento, 0) as dias_vencida
from base b;

revoke all on public.dashboard_compras_saldo_view from public, anon, authenticated;

-- ============ dashboard_lineas_venta ============
-- Una fila por línea vendida (factura no anulada con fecha en el rango) y una
-- por línea devuelta (nota de crédito emitida con fecha en el rango, D4: por
-- la fecha de la nota), con signo negativo. Montos sin IVA:
--   venta = peso × precio  (Σ por factura = `facturas.subtotal_usd`, que
--                           `invoiceService.subtotalItems` calcula igual)
--   costo = peso × factura_items.costo_usd_kg (snapshot COGS, §4.6; la
--           devolución descuenta al costo de la línea)
create or replace function public.dashboard_lineas_venta(p_desde date, p_hasta date)
returns table (
  fecha date,
  factura_id uuid,
  cliente_id uuid,
  producto_id uuid,
  condicion text,
  kg numeric,
  venta_usd numeric,
  costo_usd numeric,
  es_nota boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.fecha,
    f.id,
    f.cliente_id,
    fi.producto_id,
    f.condicion,
    fi.peso_kg,
    fi.peso_kg * fi.precio_usd_kg,
    fi.peso_kg * fi.costo_usd_kg,
    false
  from public.facturas f
  join public.factura_items fi on fi.factura_id = f.id
  where f.estado <> 'anulada'
    and f.fecha between p_desde and p_hasta
  union all
  select
    nc.fecha,
    f.id,
    f.cliente_id,
    fi.producto_id,
    f.condicion,
    -nci.peso_kg,
    -(nci.peso_kg * nci.precio_usd_kg),
    -(nci.peso_kg * fi.costo_usd_kg),
    true
  from public.notas_credito nc
  join public.nota_credito_items nci on nci.nota_credito_id = nc.id
  join public.factura_items fi on fi.id = nci.factura_item_id
  join public.facturas f on f.id = nc.factura_id
  where nc.estado = 'emitida'
    and f.estado <> 'anulada'
    and nc.fecha between p_desde and p_hasta
$$;

revoke all on function public.dashboard_lineas_venta(date, date) from public, anon, authenticated;

-- ============ ÍNDICES ============
-- Todos los indicadores por período filtran por la fecha del documento.
-- Con el volumen de prueba `explain` elige seq scan (tablas de decenas de
-- filas); estos índices sirven a los predicados de rango cuando las tablas
-- crezcan (ventas, cobros y pérdidas diarias), y el de pedidos a la lista de
-- pendientes por fecha de entrega. Ver checklist.
create index if not exists idx_facturas_fecha_no_anuladas
  on public.facturas (fecha) where estado <> 'anulada';
create index if not exists idx_pagos_fecha on public.pagos (fecha);
create index if not exists idx_pagos_proveedores_fecha on public.pagos_proveedores (fecha);
create index if not exists idx_procesamientos_fecha on public.procesamientos (fecha);
create index if not exists idx_perdidas_lote_fecha on public.perdidas_lote (fecha);
create index if not exists idx_notas_credito_fecha on public.notas_credito (fecha) where estado = 'emitida';
create index if not exists idx_pedidos_estado_entrega on public.pedidos (estado, fecha_entrega);
