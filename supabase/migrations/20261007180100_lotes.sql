-- 07-lotes (2/5): esquema de lotes y trazabilidad.
--
-- Reabre el costeo de /SPEC.md §2 (decisión del usuario, 2026-10-07): cada
-- lote conserva su costo/kg USD, su moneda y la tasa de su compra; toda
-- salida usa el costo del lote del que sale (identificación específica).
--
-- - lotes: uno por línea de compra o por línea de procesamiento. El stock de
--   un lote NO se guarda: es Σ movimientos.peso_kg del lote (ledger).
-- - movimientos.lote_id (+ tipo `perdida`). Obligatorio salvo productos con
--   `controla_stock = false` (trigger: un check no puede mirar `productos`).
-- - proceso_items.lote_origen_id (obligatorio: el ledger se vació en la
--   migración anterior).
-- - factura_item_lotes: de qué lotes salió cada línea vendida.
-- - nota_credito_item_lotes: a qué lotes volvió cada devolución (para
--   respetar lo vendido de cada lote y revertir exactamente al anular).
-- - perdidas_lote: pérdidas fuera del procesamiento (y el cierre de lote).
-- - config_negocio.dias_alerta_lote.
--
-- Escrituras: ninguna de estas tablas tiene política de insert/update; todo
-- pasa por RPC `security definer` (migraciones 4/5 y 5/5). Supone aplicada
-- 20261007180000_lotes_reinicio_datos_prueba.sql.

-- ============ lotes ============
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  producto_id uuid not null references public.productos(id),
  origen text not null check (origen in ('compra', 'proceso', 'inicial')),
  compra_item_id uuid unique references public.compra_items(id),
  proceso_item_id uuid unique references public.proceso_items(id),
  lote_padre_id uuid references public.lotes(id),
  proveedor_id uuid references public.proveedores(id),
  fecha_ingreso date not null,
  peso_inicial_kg numeric(12,3) not null check (peso_inicial_kg > 0),
  costo_usd_kg numeric(14,6) not null check (costo_usd_kg >= 0),
  moneda text not null check (moneda in ('usd', 'bs')),
  tasa_snapshot numeric(14,6) not null check (tasa_snapshot > 0),
  estado text not null default 'abierto' check (estado in ('abierto', 'agotado', 'cerrado')),
  notas text,
  created_at timestamptz not null default now(),
  -- El origen determina qué FK está llena.
  constraint lotes_origen_coherente check (
    (origen = 'compra' and compra_item_id is not null
      and proceso_item_id is null and lote_padre_id is null)
    or (origen = 'proceso' and proceso_item_id is not null
      and lote_padre_id is not null and compra_item_id is null)
    or (origen = 'inicial' and compra_item_id is null
      and proceso_item_id is null and lote_padre_id is null)
  )
);

create index idx_lotes_producto_estado_ingreso
  on public.lotes (producto_id, estado, fecha_ingreso);
create index idx_lotes_padre on public.lotes (lote_padre_id);
create index idx_lotes_proveedor on public.lotes (proveedor_id);

-- ============ movimientos ============
alter table public.movimientos
  add column lote_id uuid references public.lotes(id);

create index idx_movimientos_lote on public.movimientos (lote_id);

alter table public.movimientos drop constraint movimientos_tipo_check;
alter table public.movimientos
  add constraint movimientos_tipo_check
  check (tipo in ('compra', 'proceso_in', 'proceso_out', 'venta', 'ajuste', 'perdida'));

-- Lote obligatorio para productos que controlan stock. Equivale al check
-- `lote_id is not null` del spec con la exención de `controla_stock = false`.
create or replace function public.movimientos_exige_lote()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.lote_id is null and exists (
    select 1 from public.productos p
    where p.id = new.producto_id and p.controla_stock
  ) then
    raise exception 'El movimiento de un producto con control de stock debe indicar su lote'
      using errcode = '23514', hint = 'movimiento_sin_lote';
  end if;
  if new.lote_id is not null and not exists (
    select 1 from public.lotes l
    where l.id = new.lote_id and l.producto_id = new.producto_id
  ) then
    raise exception 'El lote no corresponde al producto del movimiento'
      using errcode = '23514', hint = 'lote_otro_producto';
  end if;
  return new;
end;
$$;

drop trigger if exists movimientos_exige_lote on public.movimientos;
create trigger movimientos_exige_lote
  before insert on public.movimientos
  for each row execute function public.movimientos_exige_lote();

-- El ledger solo se escribe por RPC (security definer): una escritura
-- directa podría dejar un lote en negativo sin pasar por el lock.
drop policy if exists "write_all" on public.movimientos;

-- ============ proceso_items ============
alter table public.proceso_items
  add column lote_origen_id uuid references public.lotes(id);

-- Sin filas tras el reinicio: obligatorio desde ya.
alter table public.proceso_items
  alter column lote_origen_id set not null;

create index idx_proceso_items_lote_origen on public.proceso_items (lote_origen_id);

-- ============ factura_item_lotes ============
create table public.factura_item_lotes (
  id uuid primary key default gen_random_uuid(),
  factura_item_id uuid not null references public.factura_items(id) on delete cascade,
  lote_id uuid not null references public.lotes(id),
  -- Orden de la asignación (PEPS o la del vendedor): la devolución recorre
  -- los lotes en orden inverso.
  orden smallint not null,
  peso_kg numeric(12,3) not null check (peso_kg > 0),
  costo_usd_kg numeric(14,6) not null check (costo_usd_kg >= 0),
  unique (factura_item_id, lote_id),
  unique (factura_item_id, orden)
);

create index idx_factura_item_lotes_lote on public.factura_item_lotes (lote_id);

-- ============ nota_credito_item_lotes ============
create table public.nota_credito_item_lotes (
  id uuid primary key default gen_random_uuid(),
  nota_credito_item_id uuid not null references public.nota_credito_items(id) on delete cascade,
  lote_id uuid not null references public.lotes(id),
  peso_kg numeric(12,3) not null check (peso_kg > 0),
  unique (nota_credito_item_id, lote_id)
);

create index idx_nota_credito_item_lotes_lote on public.nota_credito_item_lotes (lote_id);

-- ============ perdidas_lote ============
create table public.perdidas_lote (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id),
  fecha date not null default current_date,
  peso_kg numeric(12,3) not null check (peso_kg > 0),
  motivo text not null check (motivo in ('danado', 'vencido', 'faltante', 'cierre', 'otro')),
  detalle text,
  usuario_id uuid default auth.uid() references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_perdidas_lote_lote on public.perdidas_lote (lote_id, fecha);

-- ============ config_negocio ============
alter table public.config_negocio
  add column if not exists dias_alerta_lote int
    check (dias_alerta_lote is null or dias_alerta_lote between 1 and 365);

-- ============ RLS ============
-- Solo lectura para authenticated; sin políticas de insert/update/delete.
-- `lotes` y `factura_item_lotes` tienen costos: el select de la tabla base se
-- revoca en la migración de vistas (3/5) y se lee por `lotes_view` /
-- `factura_item_lotes_view`.
alter table public.lotes enable row level security;
alter table public.factura_item_lotes enable row level security;
alter table public.nota_credito_item_lotes enable row level security;
alter table public.perdidas_lote enable row level security;

create policy "lotes_read" on public.lotes
  for select to authenticated using (true);
create policy "factura_item_lotes_read" on public.factura_item_lotes
  for select to authenticated using (true);
create policy "nota_credito_item_lotes_read" on public.nota_credito_item_lotes
  for select to authenticated using (true);
create policy "perdidas_lote_read" on public.perdidas_lote
  for select to authenticated using (true);
