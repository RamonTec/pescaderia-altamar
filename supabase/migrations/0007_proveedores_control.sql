-- Migration 007: control e información de proveedores (KYC + bloqueo).
-- Extiende public.proveedores con datos de persona natural/jurídica, contacto,
-- dirección, email y bloqueo. Agrega índice único sobre upper(rif_ci) y un
-- trigger que protege bloqueado/motivo_bloqueo para que solo un admin pueda
-- cambiarlos, incluso saltándose el servicio y llamando a PostgREST directo.
-- No modifica datos existentes: los proveedores semilla quedan tipo_persona='juridica'.

alter table public.proveedores
  add column tipo_persona text not null default 'juridica'
    check (tipo_persona in ('natural', 'juridica')),
  add column email text,
  add column direccion text,
  add column contacto_nombre text,
  add column contacto_telefono text,
  add column bloqueado boolean not null default false,
  add column motivo_bloqueo text,
  add constraint proveedores_bloqueo_motivo_ck
    check (not bloqueado or length(trim(coalesce(motivo_bloqueo, ''))) > 0);

-- RIF/CI único entre proveedores, ignorando nulos y sin distinción de mayúsculas.
create unique index proveedores_rif_ci_unique
  on public.proveedores (upper(rif_ci))
  where rif_ci is not null;

-- Protección del bloqueo a nivel de base: cualquier cambio a bloqueado o
-- motivo_bloqueo (insert con bloqueado=true o update) exige ser admin.
-- La RLS de proveedores es using (true) para authenticated, así que sin este
-- trigger un operador podría bloquear/desbloquear llamando a PostgREST directo.
create or replace function public.proveedores_guard_bloqueo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bloqueado is distinct from old.bloqueado
     or new.motivo_bloqueo is distinct from old.motivo_bloqueo then
    if not public.es_admin() then
      raise exception 'Solo un administrador puede bloquear o desbloquear un proveedor'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proveedores_guard_bloqueo on public.proveedores;
create trigger proveedores_guard_bloqueo
  before insert or update on public.proveedores
  for each row execute function public.proveedores_guard_bloqueo();
