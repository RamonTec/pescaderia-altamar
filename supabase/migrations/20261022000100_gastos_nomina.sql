-- 20-gastos (Fase B): empleados y pagos de nómina.
--
-- Un pago de nómina es un gasto (no hay tabla `pagos_nomina`): una fila de
-- `gastos` con `empleado_id` y la categoría de sistema Nómina. Sin conceptos
-- ni deducciones (bonos, IVSS, FAOV…). Solo admin (RLS `es_admin()`).
--
-- - `empleados`: nombre, cédula (única, `V-`/`E-`), cargo, salario base
--   MENSUAL (P3) en su moneda, activo (se desactiva, no se borra), notas.
--   Auditoría con `fija_auditoria()` (Fase A). Cambiar el salario no toca
--   pagos hechos: cada gasto es un snapshot.
-- - `gastos.empleado_id` + índice `(empleado_id, fecha)`.
-- - `gastos_guard` versión B: conserva TODA la versión A y cambia solo la
--   regla de Nómina: categoría Nómina ⇔ `empleado_id`; la nómina exige
--   período y empleado activo. Errores P0001 con `hint`:
--   `categoria_nomina_requiere_empleado`, `empleado_requiere_nomina`,
--   `periodo_requerido`, `empleado_inactivo`. Un confirmado sigue sin
--   cambiar `empleado_id` (la comparación jsonb de la versión A lo cubre).
-- - Nunca `delete`: sin política y `revoke delete, truncate`.

-- ============ empleados ============
create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
    constraint empleados_nombre_check
    check (char_length(btrim(nombre)) between 2 and 120),
  cedula text not null
    constraint empleados_cedula_key unique
    constraint empleados_cedula_formato
    check (cedula ~ '^[VE]-[0-9]{6,10}$'),
  cargo text
    constraint empleados_cargo_check
    check (cargo is null or char_length(cargo) <= 80),
  salario_base numeric(14,6) not null check (salario_base >= 0),
  moneda text not null check (moneda in ('usd', 'bs')),
  activo boolean not null default true,
  notas text
    constraint empleados_notas_check
    check (notas is null or char_length(notas) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.perfiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles(id)
);

comment on table public.empleados is
  'Empleados para los pagos de nómina (20-gastos). Un pago es un gasto de la categoría Nómina con empleado_id. Se desactivan, no se borran. Solo admin.';
comment on column public.empleados.salario_base is
  'Salario MENSUAL (P3) en `moneda`. La quincena precarga la mitad. Sin historial: cada pago es un snapshot.';
comment on column public.empleados.cedula is
  'V-/E- + 6 a 10 dígitos (formato de RifCiField), normalizada en mayúsculas y sin espacios por el servicio.';

create trigger empleados_auditoria
  before insert or update on public.empleados
  for each row execute function public.fija_auditoria();

alter table public.empleados enable row level security;

create policy "empleados_select_admin" on public.empleados
  for select to authenticated using (public.es_admin());
create policy "empleados_insert_admin" on public.empleados
  for insert to authenticated with check (public.es_admin());
create policy "empleados_update_admin" on public.empleados
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());
-- Sin política de delete: los empleados se desactivan.

grant select, insert, update on public.empleados to authenticated;
revoke all on public.empleados from anon;
revoke delete, truncate on public.empleados from authenticated;

-- ============ gastos.empleado_id ============
alter table public.gastos
  add column empleado_id uuid references public.empleados(id);

comment on column public.gastos.empleado_id is
  'Empleado del pago de nómina. No nulo ⇔ categoría Nómina (gastos_guard). Inmutable en un confirmado.';

create index idx_gastos_empleado_fecha
  on public.gastos (empleado_id, fecha)
  where empleado_id is not null;

-- ============ gastos_guard (versión B) ============
-- Igual que la versión A salvo el bloque de Nómina (al final). Columnas que
-- un `confirmado` puede cambiar (P1 = b) y las de auditoría: se compara la
-- fila como jsonb sin ellas, así `empleado_id` queda inmutable en un
-- confirmado sin tocar esa parte.
create or replace function public.gastos_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_cat public.categorias_gasto%rowtype;
  v_padre_activo boolean;
  v_empleado_activo boolean;
  v_auditoria text[] := array['updated_at', 'updated_by'];
  v_editables_confirmado text[] := array['descripcion', 'beneficiario', 'referencia', 'notas'];
  v_revisar_categoria boolean := false;
  v_revisar_fecha boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'confirmado' then
      raise exception 'Un gasto nuevo nace confirmado'
        using errcode = 'P0001', hint = 'transicion_invalida';
    end if;
    new.confirmado_por := auth.uid();
    new.confirmado_at := now();
    new.anulado_por := null;
    new.anulado_at := null;
    new.motivo_anulacion := null;
    v_revisar_categoria := true;
    v_revisar_fecha := true;
  else
    if old.estado in ('descartado', 'anulado') then
      raise exception 'Un gasto % no se modifica', old.estado
        using errcode = 'P0001', hint = 'gasto_inmutable';
    end if;

    if new.estado is distinct from old.estado and not (
      (old.estado = 'pendiente' and new.estado in ('confirmado', 'descartado'))
      or (old.estado = 'confirmado' and new.estado = 'anulado')
    ) then
      raise exception 'Transición de estado no permitida: % → %', old.estado, new.estado
        using errcode = 'P0001', hint = 'transicion_invalida';
    end if;

    -- Las columnas de trazabilidad las fija este trigger, no el cliente.
    new.confirmado_por := old.confirmado_por;
    new.confirmado_at := old.confirmado_at;
    new.anulado_por := old.anulado_por;
    new.anulado_at := old.anulado_at;
    new.tasa_registrada_por := old.tasa_registrada_por;

    if old.estado = 'confirmado' then
      if new.estado = 'anulado' then
        -- Anular: solo cambian el estado y el motivo.
        if (to_jsonb(new) - v_auditoria - array['estado', 'motivo_anulacion'])
           is distinct from (to_jsonb(old) - v_auditoria - array['estado', 'motivo_anulacion']) then
          raise exception 'Al anular un gasto solo se indica el motivo'
            using errcode = 'P0001', hint = 'gasto_inmutable';
        end if;
        if new.motivo_anulacion is null
           or char_length(btrim(new.motivo_anulacion)) not between 5 and 500 then
          raise exception 'Indica el motivo de la anulación (5 a 500 caracteres)'
            using errcode = 'P0001', hint = 'motivo_requerido';
        end if;
        new.motivo_anulacion := btrim(new.motivo_anulacion);
        new.anulado_por := auth.uid();
        new.anulado_at := now();
      elsif (to_jsonb(new) - v_auditoria - v_editables_confirmado)
            is distinct from (to_jsonb(old) - v_auditoria - v_editables_confirmado) then
        raise exception 'Un gasto confirmado solo cambia descripción, beneficiario, referencia y notas: para corregir el importe, anúlalo y regístralo de nuevo'
          using errcode = 'P0001', hint = 'gasto_inmutable';
      end if;
    else
      -- old.estado = 'pendiente' (lo genera la Fase C).
      if new.estado = 'descartado' then
        if new.motivo_anulacion is not null
           and char_length(btrim(new.motivo_anulacion)) > 500 then
          raise exception 'El motivo admite hasta 500 caracteres'
            using errcode = 'P0001', hint = 'motivo_requerido';
        end if;
        new.motivo_anulacion := nullif(btrim(coalesce(new.motivo_anulacion, '')), '');
        new.anulado_por := auth.uid();
        new.anulado_at := now();
      else
        new.motivo_anulacion := null;
        if new.estado = 'confirmado' then
          new.confirmado_por := auth.uid();
          new.confirmado_at := now();
          v_revisar_fecha := true;
          v_revisar_categoria := true;
        elsif new.categoria_id is distinct from old.categoria_id
              or new.empleado_id is distinct from old.empleado_id
              or new.periodo_desde is distinct from old.periodo_desde
              or new.periodo_hasta is distinct from old.periodo_hasta then
          -- Versión B: cambiar empleado o período de un pendiente también
          -- revisa la coherencia de Nómina.
          v_revisar_categoria := true;
        end if;
      end if;
    end if;
  end if;

  if v_revisar_fecha and new.fecha > v_hoy then
    raise exception 'La fecha del gasto no puede ser futura'
      using errcode = 'P0001', hint = 'fecha_futura';
  end if;

  if v_revisar_categoria then
    select * into v_cat from public.categorias_gasto where id = new.categoria_id;
    if not found then
      raise exception 'La categoría no existe'
        using errcode = 'P0001', hint = 'categoria_inactiva';
    end if;
    if v_cat.categoria_padre_id is not null then
      select activo into v_padre_activo from public.categorias_gasto where id = v_cat.categoria_padre_id;
    else
      v_padre_activo := true;
    end if;
    if not v_cat.activo or not coalesce(v_padre_activo, false) then
      raise exception 'La categoría % (o su categoría padre) está inactiva', v_cat.nombre
        using errcode = 'P0001', hint = 'categoria_inactiva';
    end if;

    -- Versión B: categoría Nómina ⇔ empleado; la nómina exige período y
    -- empleado activo. (Nómina no admite subcategorías: basta su `clave`.)
    if v_cat.clave = 'nomina' then
      if new.empleado_id is null then
        raise exception 'Los pagos de nómina se registran con un empleado'
          using errcode = 'P0001', hint = 'categoria_nomina_requiere_empleado';
      end if;
      if new.periodo_desde is null or new.periodo_hasta is null then
        raise exception 'Indica el período que cubre el pago de nómina'
          using errcode = 'P0001', hint = 'periodo_requerido';
      end if;
      select activo into v_empleado_activo from public.empleados where id = new.empleado_id;
      if not coalesce(v_empleado_activo, false) then
        raise exception 'El empleado está inactivo (o no existe): no recibe pagos nuevos'
          using errcode = 'P0001', hint = 'empleado_inactivo';
      end if;
    elsif new.empleado_id is not null then
      raise exception 'Solo los gastos de Nómina llevan empleado'
        using errcode = 'P0001', hint = 'empleado_requiere_nomina';
    end if;
  end if;

  return new;
end;
$$;
