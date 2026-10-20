-- 19-edicion-compras (1/3): esquema.
--
-- El admin puede editar una compra registrada (decisión del usuario,
-- 2026-10-19): kg y costo/kg de cada línea; proveedor, fecha, notas,
-- condición, moneda y tasa de la cabecera. Con motivo obligatorio e
-- historial que solo ve el admin. Escritura solo por la RPC `editar_compra`
-- (security definer, 2/3).
--
-- - compra_items.costo_kg_pactado: costo/kg en la moneda de la compra. Hasta
--   hoy solo se guardaba el USD; para cambiar la tasa de una compra en Bs hay
--   que partir del valor pactado. Relleno de las filas existentes:
--     usd → costo_usd_kg
--     bs  → round(costo_usd_kg × tasa_snapshot, 2) (el formulario captura 2
--           decimales: recupera el valor tecleado).
--   El relleno no toca `costo_usd_kg`. Idempotente: solo rellena filas nulas.
-- - compra_items_view: `costo_kg_pactado` al final, `null` si no es admin.
-- - movimientos.tipo + `correccion_compra` (kg ± en el lote de la línea,
--   `ref_id` = la corrección). Se conserva `correccion_venta` (17).
-- - compra_correcciones + compra_correccion_items: historial permanente,
--   solo lectura del admin, sin políticas de escritura.

-- ============ compra_items.costo_kg_pactado ============
alter table public.compra_items
  add column if not exists costo_kg_pactado numeric(14,6);

update public.compra_items ci
set costo_kg_pactado = case
  when c.moneda = 'usd' then ci.costo_usd_kg
  else round(ci.costo_usd_kg * c.tasa_snapshot, 2)
end
from public.compras c
where c.id = ci.compra_id
  and ci.costo_kg_pactado is null;

alter table public.compra_items
  alter column costo_kg_pactado set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'compra_items_costo_kg_pactado_check'
      and conrelid = 'public.compra_items'::regclass
  ) then
    alter table public.compra_items
      add constraint compra_items_costo_kg_pactado_check check (costo_kg_pactado >= 0);
  end if;
end;
$$;

comment on column public.compra_items.costo_kg_pactado is
  'Costo/kg pactado en la moneda de la compra (19). costo_usd_kg = moneda usd ? round(pactado, 6) : round(pactado / tasa_snapshot, 6). Costo: solo admin (compra_items_view).';

-- ============ compra_items_view ============
-- Misma definición que 0003 con `costo_kg_pactado` al final (`create or
-- replace view` solo permite agregar columnas al final).
create or replace view public.compra_items_view
as
select
  id,
  compra_id,
  producto_id,
  peso_kg,
  case when public.es_admin() then costo_usd_kg else null end as costo_usd_kg,
  case when public.es_admin() then costo_kg_pactado else null end as costo_kg_pactado
from public.compra_items;

grant select on public.compra_items_view to authenticated;

-- ============ movimientos: tipo correccion_compra ============
alter table public.movimientos drop constraint movimientos_tipo_check;
alter table public.movimientos
  add constraint movimientos_tipo_check
  check (tipo in (
    'compra', 'proceso_in', 'proceso_out', 'venta', 'ajuste', 'perdida',
    'correccion_venta', 'correccion_compra'
  ));

-- ============ compra_correcciones ============
create table public.compra_correcciones (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id),
  proveedor_anterior_id uuid not null references public.proveedores(id),
  proveedor_nuevo_id uuid not null references public.proveedores(id),
  fecha_anterior date not null,
  fecha_nueva date not null,
  condicion_anterior text not null check (condicion_anterior in ('contado', 'credito')),
  condicion_nueva text not null check (condicion_nueva in ('contado', 'credito')),
  moneda_anterior text not null check (moneda_anterior in ('usd', 'bs')),
  moneda_nueva text not null check (moneda_nueva in ('usd', 'bs')),
  tasa_anterior numeric(14,6) not null check (tasa_anterior > 0),
  tasa_nueva numeric(14,6) not null check (tasa_nueva > 0),
  tasa_origen_anterior text not null check (tasa_origen_anterior in ('referencial', 'manual')),
  tasa_origen_nueva text not null check (tasa_origen_nueva in ('referencial', 'manual')),
  tasa_fuente_anterior text check (tasa_fuente_anterior in ('bcv', 'paralela')),
  tasa_fuente_nueva text check (tasa_fuente_nueva in ('bcv', 'paralela')),
  tasa_referencial_anterior numeric(14,6),
  tasa_referencial_nueva numeric(14,6),
  notas_anterior text,
  notas_nueva text,
  subtotal_anterior_usd numeric(14,6) not null,
  subtotal_nuevo_usd numeric(14,6) not null,
  pagado_anterior_usd numeric(14,6) not null,
  pagado_nuevo_usd numeric(14,6) not null,
  -- Σ pagos_proveedores.monto_usd al editar (explica saldo a favor y D1–D3).
  pagos_registrados_usd numeric(14,6) not null,
  estado_anterior text not null check (estado_anterior in ('abierta', 'pagada')),
  estado_nuevo text not null check (estado_nuevo in ('abierta', 'pagada')),
  -- Contrato activo al editar: queda desactualizado (derivado, 3/3).
  contrato_id uuid references public.contratos(id),
  -- Resumen informativo de la propagación del costo:
  -- { lotes: [{ lote_id, codigo, origen, costo_anterior, costo_nuevo }],
  --   procesamientos, lineas_factura, facturas }
  propagacion jsonb not null default '{}'::jsonb,
  motivo text not null
    constraint compra_correcciones_motivo_check
    check (char_length(btrim(motivo)) between 5 and 500),
  usuario_id uuid not null default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now()
);

create index idx_compra_correcciones_compra
  on public.compra_correcciones (compra_id, created_at desc);

comment on table public.compra_correcciones is
  'Historial de ediciones de compras (19): cabecera antes y después, pagos y propagación. Solo lo lee el admin; solo escribe editar_compra. Permanente.';

-- ============ compra_correccion_items ============
create table public.compra_correccion_items (
  id uuid primary key default gen_random_uuid(),
  correccion_id uuid not null references public.compra_correcciones(id),
  compra_item_id uuid not null references public.compra_items(id),
  -- null si el producto no controla stock (línea sin lote).
  lote_id uuid references public.lotes(id),
  peso_anterior_kg numeric(12,3) not null,
  peso_nuevo_kg numeric(12,3) not null check (peso_nuevo_kg > 0),
  -- En la moneda anterior y en la nueva de la compra.
  costo_pactado_anterior numeric(14,6) not null,
  costo_pactado_nuevo numeric(14,6) not null check (costo_pactado_nuevo >= 0),
  costo_anterior_usd_kg numeric(14,6) not null,
  costo_nuevo_usd_kg numeric(14,6) not null check (costo_nuevo_usd_kg >= 0),
  constraint compra_correccion_items_unica unique (correccion_id, compra_item_id)
);

create index idx_compra_correccion_items_correccion
  on public.compra_correccion_items (correccion_id);
create index idx_compra_correccion_items_item
  on public.compra_correccion_items (compra_item_id);

comment on table public.compra_correccion_items is
  'Líneas que cambiaron en una edición de compra (19): kg, costo pactado y costo USD antes y después. Solo admin; permanente.';

-- ============ RLS ============
-- Solo lectura del admin; sin políticas de escritura (solo la RPC).
alter table public.compra_correcciones enable row level security;
alter table public.compra_correccion_items enable row level security;

create policy "compra_correcciones_select_admin" on public.compra_correcciones
  for select to authenticated using (public.es_admin());
create policy "compra_correccion_items_select_admin" on public.compra_correccion_items
  for select to authenticated using (public.es_admin());

revoke all on public.compra_correcciones from anon;
revoke all on public.compra_correccion_items from anon;
revoke insert, update, delete, truncate on public.compra_correcciones from authenticated;
revoke insert, update, delete, truncate on public.compra_correccion_items from authenticated;
