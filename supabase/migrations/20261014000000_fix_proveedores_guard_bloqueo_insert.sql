-- 03-proveedores: corrige `proveedores_guard_bloqueo` (0007) en el INSERT.
--
-- En un insert `old` es null, así que `new.bloqueado is distinct from
-- old.bloqueado` siempre era verdadero (false ≠ null) y el trigger exigía
-- admin para TODA alta de proveedor, aunque llegara sin bloqueo: un operador
-- no podía crear proveedores, ni la service role (scripts de carga).
-- El spec solo protege cambios al bloqueo: en el alta, exige admin solo si el
-- proveedor nace bloqueado o con motivo. El update no cambia.

create or replace function public.proveedores_guard_bloqueo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and (new.bloqueado or new.motivo_bloqueo is not null))
     or (tg_op = 'UPDATE' and (
       new.bloqueado is distinct from old.bloqueado
       or new.motivo_bloqueo is distinct from old.motivo_bloqueo
     )) then
    if not public.es_admin() then
      raise exception 'Solo un administrador puede bloquear o desbloquear un proveedor'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
