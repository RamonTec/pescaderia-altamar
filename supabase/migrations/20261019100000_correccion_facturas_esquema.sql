-- 17-trazabilidad-y-correccion-facturas (1/3): esquema.
--
-- Reabre "la factura original nunca se edita" de 05-ventas §4.4 (decisión del
-- usuario, 2026-10-19): el admin puede corregir el peso y el precio/kg de una
-- línea, con motivo obligatorio e historial que solo ve el admin.
--
-- - factura_correcciones: una fila por corrección de una línea, con los
--   valores anteriores y nuevos de la línea y de los totales. Los kg movidos
--   por lote no se duplican aquí: son los movimientos `correccion_venta` del
--   ledger con `ref_id` = id de la corrección. Permanente: sin update/delete.
-- - movimientos.tipo + `correccion_venta` (no es `ajuste`, que ya significa
--   inventario inicial y devoluciones de notas de crédito).
-- - config_negocio.tolerancia_precio_ref_pct: tolerancia simétrica de las
--   señales "Por debajo" / "Cobro mayor" (default 0 %: marca cualquier
--   diferencia).
--
-- Escritura: solo la RPC `corregir_linea_factura` (security definer, 2/3).

-- ============ factura_correcciones ============
create table public.factura_correcciones (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id),
  factura_item_id uuid not null references public.factura_items(id),
  peso_anterior_kg numeric(12,3) not null,
  peso_nuevo_kg numeric(12,3) not null check (peso_nuevo_kg > 0),
  precio_anterior_usd_kg numeric(14,6) not null,
  precio_nuevo_usd_kg numeric(14,6) not null check (precio_nuevo_usd_kg >= 0),
  costo_anterior_usd_kg numeric(14,6) not null,
  costo_nuevo_usd_kg numeric(14,6) not null,
  subtotal_anterior_usd numeric(14,6) not null,
  subtotal_nuevo_usd numeric(14,6) not null,
  iva_anterior_usd numeric(14,6) not null,
  iva_nuevo_usd numeric(14,6) not null,
  total_anterior_usd numeric(14,6) not null,
  total_nuevo_usd numeric(14,6) not null,
  -- Lo pagado al corregir (explica un saldo a favor).
  pagado_usd numeric(14,6) not null,
  estado_anterior text not null check (estado_anterior in ('abierta', 'pagada')),
  estado_nuevo text not null check (estado_nuevo in ('abierta', 'pagada')),
  -- Contrato activo al corregir: queda desactualizado (derivado, 3/3).
  contrato_id uuid references public.contratos(id),
  motivo text not null
    constraint factura_correcciones_motivo_check
    check (char_length(btrim(motivo)) between 5 and 500),
  usuario_id uuid not null default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  constraint factura_correcciones_cambio_real check (
    peso_nuevo_kg <> peso_anterior_kg or precio_nuevo_usd_kg <> precio_anterior_usd_kg
  )
);

create index idx_factura_correcciones_factura
  on public.factura_correcciones (factura_id, created_at desc);
create index idx_factura_correcciones_item
  on public.factura_correcciones (factura_item_id);

comment on table public.factura_correcciones is
  'Historial de correcciones de peso y precio/kg de líneas de factura (17). Solo lo lee el admin; solo escribe corregir_linea_factura. Permanente.';

-- RLS: solo lectura del admin; sin políticas de escritura (solo la RPC).
alter table public.factura_correcciones enable row level security;

create policy "factura_correcciones_select_admin" on public.factura_correcciones
  for select to authenticated using (public.es_admin());

revoke all on public.factura_correcciones from anon;
revoke insert, update, delete, truncate on public.factura_correcciones from authenticated;

-- ============ movimientos: tipo correccion_venta ============
alter table public.movimientos drop constraint movimientos_tipo_check;
alter table public.movimientos
  add constraint movimientos_tipo_check
  check (tipo in (
    'compra', 'proceso_in', 'proceso_out', 'venta', 'ajuste', 'perdida', 'correccion_venta'
  ));

-- ============ config_negocio: tolerancia de señales ============
alter table public.config_negocio
  add column if not exists tolerancia_precio_ref_pct numeric(5,2) not null default 0
    constraint config_negocio_tolerancia_precio_ref_pct_check
    check (tolerancia_precio_ref_pct between 0 and 100);

comment on column public.config_negocio.tolerancia_precio_ref_pct is
  'Tolerancia % simétrica frente al precio de referencia para las señales "Por debajo" y "Cobro mayor" de las facturas (17). 0 = marca cualquier diferencia.';
