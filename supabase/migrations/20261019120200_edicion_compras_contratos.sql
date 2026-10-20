-- 19-edicion-compras (3/3): contrato de compra desactualizado.
--
-- Misma regla derivada de 17, sin escribir en `contratos` (el trigger
-- `contratos_validar` y el PDF inmutable de 06 no cambian): un contrato no
-- anulado está desactualizado si su factura o su compra tiene una
-- corrección posterior a su `created_at`.
--
-- Misma definición que 20261019100200_correccion_facturas_contratos.sql; solo
-- cambia el lateral de `ultima_correccion_at`, que ahora es el máximo entre
-- `factura_correcciones` (por `factura_id`) y `compra_correcciones` (por
-- `compra_id`). Columnas, orden y fórmula de `desactualizado` iguales. Sigue
-- siendo `security_invoker`: hereda la RLS solo admin de `contratos`,
-- `factura_correcciones` y `compra_correcciones`.

create or replace view public.contratos_listado_view
with (security_invoker = true) as
select
  ct.id,
  ct.numero,
  ct.tipo,
  ct.factura_id,
  ct.compra_id,
  ct.fecha,
  ct.dias_credito,
  ct.fecha_vencimiento,
  ct.estado,
  ct.url_storage,
  ct.notas,
  ct.generado_por,
  ct.estado_cambiado_por,
  ct.estado_cambiado_at,
  ct.created_at,
  coalesce(f.cliente_id, c.proveedor_id) as contraparte_id,
  coalesce(cl.nombre, pr.nombre) as contraparte_nombre,
  coalesce(cl.rif_ci, pr.rif_ci) as contraparte_rif_ci,
  coalesce(f.fecha, c.fecha) as documento_fecha,
  f.numero as documento_numero,
  coalesce(f.total_usd, c.subtotal_usd) as monto_usd,
  (coalesce(f.estado, c.estado) = 'anulada') as origen_anulado,
  lower(
    ct.numero::text || ' ' || lpad(ct.numero::text, 4, '0') || ' '
    || coalesce(f.numero::text || ' ' || lpad(f.numero::text, 6, '0'), '') || ' '
    || coalesce(cl.nombre, pr.nombre, '') || ' '
    || coalesce(cl.rif_ci, pr.rif_ci, '')
  ) as busqueda,
  fc.ultima_correccion_at,
  coalesce(ct.estado <> 'anulado' and fc.ultima_correccion_at > ct.created_at, false) as desactualizado
from public.contratos ct
left join public.facturas f on f.id = ct.factura_id
left join public.clientes cl on cl.id = f.cliente_id
left join public.compras c on c.id = ct.compra_id
left join public.proveedores pr on pr.id = c.proveedor_id
left join lateral (
  select greatest(
    (select max(x.created_at) from public.factura_correcciones x where x.factura_id = ct.factura_id),
    (select max(y.created_at) from public.compra_correcciones y where y.compra_id = ct.compra_id)
  ) as ultima_correccion_at
) fc on true;
