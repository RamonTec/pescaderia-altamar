-- Migration 006: documentos de cliente (cédula / RIF) subidos a Storage privado.
-- Solo se guarda la ruta en Storage (url_storage); para ver/descargar se genera
-- una signed URL al vuelo (mismo patrón que 06-contratos).

create table public.documentos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('cedula', 'rif', 'otro')),
  url_storage text not null,
  created_at timestamptz not null default now()
);

create index idx_documentos_cliente on public.documentos_cliente (cliente_id);

alter table public.documentos_cliente enable row level security;

create policy "read_all" on public.documentos_cliente
  for select to authenticated using (true);
create policy "write_all" on public.documentos_cliente
  for insert to authenticated with check (true);
create policy "update_all" on public.documentos_cliente
  for update to authenticated using (true);
create policy "delete_all" on public.documentos_cliente
  for delete to authenticated using (true);
