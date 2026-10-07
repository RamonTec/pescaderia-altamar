-- Migration 009: métodos de pago de proveedores.
-- Varios métodos por proveedor: transferencia (cuenta 20 dígitos), Pago Móvil y Zelle.
-- Checks por tipo que exigen los campos obligatorios de cada uno (la misma regla
-- vive en el esquema zod). A lo sumo un método preferido por proveedor.

create table public.metodos_pago_proveedor (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  tipo text not null check (tipo in ('transferencia', 'pago_movil', 'zelle')),
  banco_codigo text,
  numero_cuenta text check (numero_cuenta is null or numero_cuenta ~ '^\d{20}$'),
  tipo_cuenta text check (tipo_cuenta is null or tipo_cuenta in ('corriente', 'ahorro')),
  telefono text,
  email text,
  titular text,
  titular_rif_ci text,
  preferido boolean not null default false,
  created_at timestamptz not null default now(),
  constraint metodos_pago_transferencia_ck check (
    tipo <> 'transferencia'
    or (
      numero_cuenta is not null
      and banco_codigo is not null
      and titular is not null
      and titular_rif_ci is not null
    )
  ),
  constraint metodos_pago_pago_movil_ck check (
    tipo <> 'pago_movil'
    or (
      banco_codigo is not null
      and telefono is not null
      and titular_rif_ci is not null
    )
  ),
  constraint metodos_pago_zelle_ck check (
    tipo <> 'zelle'
    or (
      titular is not null
      and (email is not null or telefono is not null)
    )
  )
);

create index idx_metodos_pago_proveedor on public.metodos_pago_proveedor (proveedor_id);
create unique index metodos_pago_preferido_unique
  on public.metodos_pago_proveedor (proveedor_id)
  where preferido;

alter table public.metodos_pago_proveedor enable row level security;

create policy "read_all" on public.metodos_pago_proveedor
  for select to authenticated using (true);
create policy "write_all" on public.metodos_pago_proveedor
  for insert to authenticated with check (true);
create policy "update_all" on public.metodos_pago_proveedor
  for update to authenticated using (true);
create policy "delete_all" on public.metodos_pago_proveedor
  for delete to authenticated using (true);
