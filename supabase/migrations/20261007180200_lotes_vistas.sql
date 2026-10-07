-- 07-lotes (3/5): vistas protegidas y funciones internas de lotes.
--
-- Mismo enfoque que 0003: vistas `security definer` (por defecto) que anulan
-- el costo si `not es_admin()`, y `revoke select` de las tablas base con
-- costos. El operador ve código, producto, proveedor, fechas, kg y estado.

-- ============ lotes_stock ============
-- Stock de cada lote = Σ movimientos del lote (nunca una columna que se
-- pueda desincronizar del ledger).
create or replace view public.lotes_stock
as
select
  l.id as lote_id,
  l.producto_id,
  coalesce(sum(m.peso_kg), 0)::numeric(12,3) as stock_kg
from public.lotes l
left join public.movimientos m on m.lote_id = l.id
group by l.id, l.producto_id;

-- ============ lotes_view ============
create or replace view public.lotes_view
as
select
  l.id,
  l.codigo,
  l.producto_id,
  p.nombre as producto_nombre,
  p.codigo as producto_codigo,
  p.tipo as producto_tipo,
  l.origen,
  l.compra_item_id,
  ci.compra_id,
  l.proceso_item_id,
  pi.procesamiento_id,
  l.lote_padre_id,
  lp.codigo as lote_padre_codigo,
  l.proveedor_id,
  pr.nombre as proveedor_nombre,
  l.fecha_ingreso,
  l.peso_inicial_kg,
  coalesce((
    select sum(m.peso_kg) from public.movimientos m where m.lote_id = l.id
  ), 0)::numeric(12,3) as stock_kg,
  case when public.es_admin() then l.costo_usd_kg else null end as costo_usd_kg,
  l.moneda,
  l.tasa_snapshot,
  l.estado,
  l.notas,
  l.created_at
from public.lotes l
join public.productos p on p.id = l.producto_id
left join public.compra_items ci on ci.id = l.compra_item_id
left join public.proceso_items pi on pi.id = l.proceso_item_id
left join public.lotes lp on lp.id = l.lote_padre_id
left join public.proveedores pr on pr.id = l.proveedor_id;

-- ============ factura_item_lotes_view ============
create or replace view public.factura_item_lotes_view
as
select
  fil.id,
  fil.factura_item_id,
  fil.lote_id,
  fil.orden,
  fil.peso_kg,
  case when public.es_admin() then fil.costo_usd_kg else null end as costo_usd_kg
from public.factura_item_lotes fil;

-- ============ perdidas_lote_view ============
-- Con el nombre de quien la registró (`perfiles` solo deja leer el propio
-- perfil al operador). Sin costos: el valor perdido se calcula con el costo
-- del lote, que solo ve el admin.
create or replace view public.perdidas_lote_view
as
select
  pl.id,
  pl.lote_id,
  pl.fecha,
  pl.peso_kg,
  pl.motivo,
  pl.detalle,
  pl.usuario_id,
  pf.nombre as usuario_nombre,
  pl.created_at
from public.perdidas_lote pl
left join public.perfiles pf on pf.id = pl.usuario_id;

-- ============ movimientos_view (agrega lote_id) ============
-- Misma definición que 0003 con `lote_id` al final (create or replace solo
-- permite agregar columnas al final).
create or replace view public.movimientos_view
as
select
  id,
  producto_id,
  fecha,
  tipo,
  peso_kg,
  case when public.es_admin() then costo_usd_kg else null end as costo_usd_kg,
  ref_id,
  created_at,
  lote_id
from public.movimientos;

-- ============ REVOKE base / GRANT views ============
revoke select on public.lotes from authenticated, anon;
revoke select on public.factura_item_lotes from authenticated, anon;

grant select on public.lotes_stock to authenticated;
grant select on public.lotes_view to authenticated;
grant select on public.factura_item_lotes_view to authenticated;
grant select on public.perdidas_lote_view to authenticated;
grant select on public.movimientos_view to authenticated;

-- ============ Funciones internas (no expuestas) ============

-- Código legible para rotular la cava: <productos.codigo>-<AAMMDD>-<n>
-- (ej. SALM-261005-1), `n` consecutivo por producto y día. Sin código de
-- producto, usa las primeras letras del nombre. Serializa por producto y día
-- con un advisory lock para que dos compras simultáneas no generen el mismo.
create or replace function public.generar_codigo_lote(p_producto_id uuid, p_fecha date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text;
  v_n int;
  v_codigo text;
begin
  select coalesce(
    nullif(upper(regexp_replace(p.codigo, '\s+', '', 'g')), ''),
    nullif(upper(left(regexp_replace(p.nombre, '[^A-Za-z0-9]', '', 'g'), 4)), ''),
    'LOTE'
  )
  into v_prefijo
  from public.productos p
  where p.id = p_producto_id;

  if v_prefijo is null then
    raise exception 'El producto no existe' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('lote:' || p_producto_id::text || ':' || p_fecha::text));

  select count(*) + 1 into v_n
  from public.lotes
  where producto_id = p_producto_id and fecha_ingreso = p_fecha;

  loop
    v_codigo := v_prefijo || '-' || to_char(p_fecha, 'YYMMDD') || '-' || v_n;
    exit when not exists (select 1 from public.lotes where codigo = v_codigo);
    v_n := v_n + 1;
  end loop;

  return v_codigo;
end;
$$;

revoke all on function public.generar_codigo_lote(uuid, date) from public, anon, authenticated;

-- Stock actual de un lote (ledger).
create or replace function public.lote_stock(p_lote_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(m.peso_kg), 0)
  from public.movimientos m
  where m.lote_id = p_lote_id
$$;

revoke all on function public.lote_stock(uuid) from public, anon, authenticated;

-- `abierto` → `agotado` al llegar a 0 kg; `agotado` → `abierto` si vuelve a
-- tener stock. `cerrado` solo lo cambia quien llama (cierre o devolución).
create or replace function public.lote_sincronizar_estado(p_lote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric := public.lote_stock(p_lote_id);
begin
  update public.lotes
  set estado = case
    when v_stock <= 0 and estado = 'abierto' then 'agotado'
    when v_stock > 0 and estado = 'agotado' then 'abierto'
    else estado
  end
  where id = p_lote_id;
end;
$$;

revoke all on function public.lote_sincronizar_estado(uuid) from public, anon, authenticated;
