-- Migration 002: roles y perfiles (admin/operador)
-- Sistema cerrado: hoy no se registran operadores, pero el esquema queda
-- preparado para diferenciar roles si en el futuro entra uno. Ver 0003 para
-- el filtrado de columnas de costo por rol.

-- ============ PERFILES (1:1 con auth.users) ============
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  rol text not null default 'operador' check (rol in ('admin', 'operador')),
  created_at timestamptz not null default now()
);

-- ============ TRIGGER: crear perfil al crear usuario ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ BACKFILL: perfiles para usuarios ya existentes ============
insert into public.perfiles (id, nombre)
select id, coalesce(raw_user_meta_data ->> 'nombre', email)
from auth.users
on conflict (id) do nothing;

-- ============ RLS de perfiles ============
alter table public.perfiles enable row level security;

create function public.es_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

create policy "perfil_lectura_propia" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_admin());

create policy "perfil_update_admin" on public.perfiles
  for update to authenticated using (public.es_admin());

create policy "perfil_insert_admin" on public.perfiles
  for insert to authenticated with check (public.es_admin());

-- ============ SEED: promover admins por defecto (idempotente) ============
update public.perfiles
set rol = 'admin'
where id in (
  select id from auth.users
  where email in (
    'inirida@altamar.com',
    'cristina@altamar.com',
    'elias@altamar.com'
  )
);
