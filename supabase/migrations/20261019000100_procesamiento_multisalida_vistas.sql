-- 16-procesamiento-multisalida (2/3): vistas protegidas.
--
-- Cierra la deuda de 04-inventario / 07-lotes / 15-dashboard: el operador
-- podía leer `proceso_items.costo_total_usd` por PostgREST (`read_all` de
-- 0001). Mismo patrón que `lotes_view` (20261007180200): vistas con el
-- privilegio de su dueño que anulan el costo si `not es_admin()`, y
-- `revoke select` de las tablas base.
--
-- `lotes_view` y las RPC `dashboard_*` son del dueño / `security definer`:
-- siguen leyendo las tablas base. Escritura: solo la RPC
-- `registrar_procesamiento` (`security definer`); se retiran las políticas
-- `write_all` de insert.

-- ============ procesamientos_view ============
-- Cabecera con el lote y el crudo de origen (para el listado sin embebidos
-- entre vistas).
create or replace view public.procesamientos_view
as
select
  pr.id,
  pr.fecha,
  pr.notas,
  pr.created_at,
  pr.lote_origen_id,
  lo.codigo as lote_origen_codigo,
  lo.producto_id as producto_origen_id,
  po.nombre as producto_origen_nombre,
  po.codigo as producto_origen_codigo,
  pr.peso_entrada_kg,
  case when public.es_admin() then pr.costo_total_usd else null end as costo_total_usd,
  pr.reparto_costo
from public.procesamientos pr
left join public.lotes lo on lo.id = pr.lote_origen_id
left join public.productos po on po.id = lo.producto_id;

-- ============ proceso_items_view ============
-- Una fila por salida, con los productos, el lote de origen y el lote hijo
-- generado (si el procesado controla stock).
create or replace view public.proceso_items_view
as
select
  pi.id,
  pi.procesamiento_id,
  pr.fecha,
  pi.producto_origen_id,
  po.nombre as producto_origen_nombre,
  po.codigo as producto_origen_codigo,
  pi.lote_origen_id,
  lo.codigo as lote_origen_codigo,
  pi.peso_entrada_kg,
  pi.producto_destino_id,
  pd.nombre as producto_destino_nombre,
  pd.codigo as producto_destino_codigo,
  pi.peso_salida_kg,
  case when public.es_admin() then pi.costo_total_usd else null end as costo_total_usd,
  pi.precio_referencia_usd_kg,
  ld.id as lote_destino_id,
  ld.codigo as lote_destino_codigo
from public.proceso_items pi
join public.procesamientos pr on pr.id = pi.procesamiento_id
join public.productos po on po.id = pi.producto_origen_id
join public.productos pd on pd.id = pi.producto_destino_id
left join public.lotes lo on lo.id = pi.lote_origen_id
left join public.lotes ld on ld.proceso_item_id = pi.id;

-- ============ REVOKE base / GRANT views ============
revoke select on public.procesamientos from authenticated, anon;
revoke select on public.proceso_items from authenticated, anon;

grant select on public.procesamientos_view to authenticated;
grant select on public.proceso_items_view to authenticated;

-- ============ Sin escritura directa ============
drop policy if exists "write_all" on public.procesamientos;
drop policy if exists "write_all" on public.proceso_items;
-- `read_all` se conserva (como en `lotes`): sin `grant select` el operador no
-- llega a la tabla base, y la política no afecta a las vistas.
