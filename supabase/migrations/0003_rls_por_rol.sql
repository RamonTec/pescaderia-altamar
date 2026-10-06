-- Migration 003: RLS por rol — protección de columnas de costo
--
-- Decisión documentada (ver spec 01-auth Fase 2 y checklist):
--   Supabase RLS es *row-level*, no column-level, y todos los usuarios se
--   conectan como la role Postgres `authenticated` (admin y operador por
--   igual). No es posible GRANT/REVOKE por columna "solo para operador":
--   un REVOKE de la columna afectaría también al admin.
--
--   Enfoque elegido: una vista por tabla sensible que anula la columna de
--   costo cuando `es_admin()` es falso. Se revoca el SELECT sobre las tablas
--   base y se otorga SELECT solo sobre las vistas. El admin sigue viendo el
--   costo real; el operador recibe `null` (no reconstruible desde precio/peso).
--
--   Por qué `security definer` (default) y NO `security_invoker`:
--   una vista `security_invoker` valida los privilegios del *invocador* sobre
--   las tablas base, de modo que el `revoke select` que impide leer la tabla
--   base directamente también rompería la vista. Con `security definer` la
--   vista se ejecuta con los privilegios de su dueño (puede leer la tabla) y
--   el `case ... es_admin()` se evalúa por fila leyendo el JWT del invocador
--   (`auth.uid()` es un GUC de sesión, disponible dentro de la vista). La RLS
--   de las tablas base hoy es `using (true)` para `authenticated` (sin
--   distinción de fila), así que no se pierde protección a nivel de fila.

-- ============ VIEWS (security definer) ============

create view public.movimientos_view
as
select
  id,
  producto_id,
  fecha,
  tipo,
  peso_kg,
  case when public.es_admin() then costo_usd_kg else null end as costo_usd_kg,
  ref_id,
  created_at
from public.movimientos;

create view public.compra_items_view
as
select
  id,
  compra_id,
  producto_id,
  peso_kg,
  case when public.es_admin() then costo_usd_kg else null end as costo_usd_kg
from public.compra_items;

create view public.factura_items_view
as
select
  id,
  factura_id,
  producto_id,
  peso_kg,
  precio_usd_kg,
  case when public.es_admin() then costo_usd_kg else null end as costo_usd_kg
from public.factura_items;

-- ============ REVOKE base / GRANT views ============
-- Impide leer las tablas base directamente (incluida la columna de costo);
-- toda lectura de estas tablas debe pasar por la vista correspondiente.
revoke select on public.movimientos from authenticated;
revoke select on public.compra_items from authenticated;
revoke select on public.factura_items from authenticated;

grant select on public.movimientos_view to authenticated;
grant select on public.compra_items_view to authenticated;
grant select on public.factura_items_view to authenticated;
