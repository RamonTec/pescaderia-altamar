-- Migration 005: representantes legales de clientes persona jurídica
-- Un cliente juridica exige al menos un representante legal; un natural no lo necesita.

create table public.representantes_legales (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nombre text not null,
  cedula text not null,
  cargo text,
  telefono text,
  created_at timestamptz not null default now()
);

create index idx_representantes_cliente on public.representantes_legales (cliente_id);

alter table public.representantes_legales enable row level security;

create policy "read_all" on public.representantes_legales
  for select to authenticated using (true);
create policy "write_all" on public.representantes_legales
  for insert to authenticated with check (true);
create policy "update_all" on public.representantes_legales
  for update to authenticated using (true);
create policy "delete_all" on public.representantes_legales
  for delete to authenticated using (true);
