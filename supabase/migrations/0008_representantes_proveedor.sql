-- Migration 008: representantes legales de proveedores persona jurídica.
-- Mismo esquema que representantes_legales (0005) pero con FK real a proveedores.
-- Un proveedor juridica exige al menos un representante legal; un natural no lo necesita.

create table public.representantes_proveedor (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  nombre text not null,
  cedula text not null,
  cargo text,
  telefono text,
  created_at timestamptz not null default now()
);

create index idx_representantes_proveedor on public.representantes_proveedor (proveedor_id);

alter table public.representantes_proveedor enable row level security;

create policy "read_all" on public.representantes_proveedor
  for select to authenticated using (true);
create policy "write_all" on public.representantes_proveedor
  for insert to authenticated with check (true);
create policy "update_all" on public.representantes_proveedor
  for update to authenticated using (true);
create policy "delete_all" on public.representantes_proveedor
  for delete to authenticated using (true);
