-- Migration 011: configuración del negocio (singleton).
-- IVA por defecto, fuente de tasa preferida y umbral global de stock bajo.
-- Patrón singleton: una sola fila con id = 1 (check single_row).

create table public.config_negocio (
  id int primary key default 1,
  iva_pct numeric(5,2) not null default 16,
  fuente_tasa_default text not null default 'bcv'
    check (fuente_tasa_default in ('bcv', 'paralela')),
  umbral_stock_bajo_kg numeric(12,3),
  constraint single_row check (id = 1)
);

-- Fila única de configuración (idempotente si se re-ejecuta).
insert into public.config_negocio (id, iva_pct, fuente_tasa_default)
values (1, 16, 'bcv')
on conflict (id) do nothing;

-- ============ RLS ============
alter table public.config_negocio enable row level security;

-- Cualquier usuario autenticado puede leer la configuración.
create policy "config_read" on public.config_negocio
  for select to authenticated using (true);

-- Solo un admin puede escribir la configuración.
create policy "config_insert_admin" on public.config_negocio
  for insert to authenticated with check (public.es_admin());

create policy "config_update_admin" on public.config_negocio
  for update to authenticated using (public.es_admin());
