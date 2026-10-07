-- Migration 010: documentos de proveedor (cédula / RIF / acta constitutiva / otro)
-- subidos a un bucket de Storage privado, creado en esta misma migración.
-- Solo se guarda la ruta en Storage (url_storage); para ver/descargar se genera
-- una signed URL al vuelo (mismo patrón que 06-contratos).

create table public.documentos_proveedor (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  tipo text not null check (tipo in ('cedula', 'rif', 'acta_constitutiva', 'otro')),
  representante_id uuid references public.representantes_proveedor(id) on delete cascade,
  url_storage text not null,
  nombre_original text,
  mime_type text,
  tamano_bytes integer,
  created_at timestamptz not null default now()
);

create index idx_documentos_proveedor on public.documentos_proveedor (proveedor_id);
create index idx_documentos_proveedor_rep on public.documentos_proveedor (representante_id);

alter table public.documentos_proveedor enable row level security;

create policy "read_all" on public.documentos_proveedor
  for select to authenticated using (true);
create policy "write_all" on public.documentos_proveedor
  for insert to authenticated with check (true);
create policy "update_all" on public.documentos_proveedor
  for update to authenticated using (true);
create policy "delete_all" on public.documentos_proveedor
  for delete to authenticated using (true);

-- ============ BUCKET DE STORAGE ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-proveedores',
  'documentos-proveedores',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Políticas sobre storage.objects para authenticated, acotadas al bucket.
create policy "documentos_proveedores_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'documentos-proveedores');
create policy "documentos_proveedores_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-proveedores');
create policy "documentos_proveedores_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'documentos-proveedores');
create policy "documentos_proveedores_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-proveedores');
