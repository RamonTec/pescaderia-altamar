-- 20-gastos (Fase C): plantillas de gastos recurrentes y pendientes de confirmar.
--
-- - `gastos_recurrentes`: plantillas periódicas (alquiler, nómina recurrente,
--   servicios). Frecuencia mensual o quincenal (P6). Si es Nómina, categoría
--   Nómina ⇔ empleado_id; monto nulo toma el salario vigente del empleado (P3).
--   Solo admin (RLS `es_admin()`). Desactivar en lugar de borrar.
-- - `gastos.recurrente_id` + índice único parcial `(recurrente_id, periodo_desde)`.
-- - `gastos_guard` versión C:
--     * INSERT: permite `pendiente` solo si `recurrente_id` no es nulo.
--     * UPDATE: `recurrente_id` inmutable; transiciones `pendiente → confirmado | descartado`,
--       `confirmado → anulado`. Conserva todas las invariantes de las versiones A y B.
-- - `gasto_recurrente_monto`: función interna (sin grant) que resuelve la moneda
--   y monto de la plantilla (o salario del empleado).
-- - `generar_gastos_recurrentes(p_hasta date default null)`: RPC security definer
--   que genera gastos pendientes de confirmar de forma idempotente con tope 12
--   por plantilla. Solo admin.

-- ============ gastos_recurrentes ============
create table public.gastos_recurrentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
    constraint gastos_recurrentes_nombre_check
    check (char_length(btrim(nombre)) between 2 and 80),
  categoria_id uuid not null references public.categorias_gasto(id),
  empleado_id uuid references public.empleados(id),
  descripcion text not null
    constraint gastos_recurrentes_descripcion_check
    check (char_length(btrim(descripcion)) between 3 and 200),
  beneficiario text
    constraint gastos_recurrentes_beneficiario_check
    check (beneficiario is null or char_length(beneficiario) <= 120),
  moneda text not null check (moneda in ('usd', 'bs')),
  monto numeric(14,6) check (monto is null or monto > 0),
  frecuencia text not null check (frecuencia in ('mensual', 'quincenal')),
  dia_mes smallint
    check (dia_mes is null or (frecuencia = 'mensual' and dia_mes between 1 and 28)),
  fecha_inicio date not null,
  fecha_fin date check (fecha_fin is null or fecha_fin >= fecha_inicio),
  metodo_pago text check (
    metodo_pago is null or metodo_pago in (
      'efectivo_usd', 'efectivo_bs', 'pago_movil', 'zelle', 'transferencia', 'punto'
    )
  ),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.perfiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles(id),

  constraint gastos_recurrentes_monto_o_empleado
    check (monto is not null or empleado_id is not null)
);

comment on table public.gastos_recurrentes is
  'Plantillas de gastos recurrentes (20-gastos). Generan gastos en estado pendiente para confirmar. Solo admin.';
comment on column public.gastos_recurrentes.monto is
  'Monto fijo del gasto recurrente. Nulo solo si empleado_id no es nulo (toma el salario del empleado).';
comment on column public.gastos_recurrentes.dia_mes is
  'Día del mes programado (1 a 28, solo mensual). Si es nulo, el último día del mes.';

create trigger gastos_recurrentes_auditoria
  before insert or update on public.gastos_recurrentes
  for each row execute function public.fija_auditoria();

-- Trigger de validación de consistencia de gastos_recurrentes
create or replace function public.gastos_recurrentes_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cat public.categorias_gasto%rowtype;
  v_padre_activo boolean;
  v_emp_activo boolean;
begin
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
    raise exception 'La categoría % (o su padre) está inactiva', v_cat.nombre
      using errcode = 'P0001', hint = 'categoria_inactiva';
  end if;

  if v_cat.clave = 'nomina' then
    if new.empleado_id is null then
      raise exception 'Una plantilla recurrente de Nómina requiere indicar el empleado'
        using errcode = 'P0001', hint = 'categoria_nomina_requiere_empleado';
    end if;
    select activo into v_emp_activo from public.empleados where id = new.empleado_id;
    if not coalesce(v_emp_activo, false) then
      raise exception 'El empleado está inactivo (o no existe)'
        using errcode = 'P0001', hint = 'empleado_inactivo';
    end if;
  elsif new.empleado_id is not null then
    raise exception 'Solo las plantillas de Nómina pueden asociar un empleado'
      using errcode = 'P0001', hint = 'empleado_requiere_nomina';
  end if;

  return new;
end;
$$;

create trigger gastos_recurrentes_guard_trigger
  before insert or update on public.gastos_recurrentes
  for each row execute function public.gastos_recurrentes_guard();

alter table public.gastos_recurrentes enable row level security;

create policy "gastos_recurrentes_select_admin" on public.gastos_recurrentes
  for select to authenticated using (public.es_admin());
create policy "gastos_recurrentes_insert_admin" on public.gastos_recurrentes
  for insert to authenticated with check (public.es_admin());
create policy "gastos_recurrentes_update_admin" on public.gastos_recurrentes
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());
-- Sin política de delete: se desactivan.

grant select, insert, update on public.gastos_recurrentes to authenticated;
revoke all on public.gastos_recurrentes from anon;
revoke delete, truncate on public.gastos_recurrentes from authenticated;

-- ============ gastos.recurrente_id ============
alter table public.gastos
  add column recurrente_id uuid references public.gastos_recurrentes(id);

comment on column public.gastos.recurrente_id is
  'Plantilla recurrente que generó este gasto (Fase C). Inmutable.';

create unique index idx_gastos_recurrente_periodo
  on public.gastos (recurrente_id, periodo_desde)
  where recurrente_id is not null;

create index idx_gastos_estado_pendiente
  on public.gastos (estado)
  where estado = 'pendiente';

-- ============ gastos_guard (versión C) ============
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
    if new.estado not in ('confirmado', 'pendiente') then
      raise exception 'Transición de estado no permitida: %', new.estado
        using errcode = 'P0001', hint = 'transicion_invalida';
    end if;

    if new.estado = 'pendiente' and new.recurrente_id is null then
      raise exception 'Un gasto nuevo sin plantilla nace confirmado'
        using errcode = 'P0001', hint = 'transicion_invalida';
    end if;

    if new.estado = 'confirmado' then
      new.confirmado_por := auth.uid();
      new.confirmado_at := now();
      v_revisar_fecha := true;
    else
      new.confirmado_por := null;
      new.confirmado_at := null;
    end if;

    new.anulado_por := null;
    new.anulado_at := null;
    new.motivo_anulacion := null;
    v_revisar_categoria := true;
  else
    if old.estado in ('descartado', 'anulado') then
      raise exception 'Un gasto % no se modifica', old.estado
        using errcode = 'P0001', hint = 'gasto_inmutable';
    end if;

    if new.recurrente_id is distinct from old.recurrente_id then
      raise exception 'El campo recurrente_id es inmutable'
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
      -- old.estado = 'pendiente'
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

-- ============ gasto_recurrente_monto (interna) ============
create or replace function public.gasto_recurrente_monto(p_recurrente_id uuid)
returns table(moneda text, monto numeric(14,6))
language plpgsql
stable
set search_path = public
as $$
declare
  v_rec public.gastos_recurrentes%rowtype;
  v_emp public.empleados%rowtype;
begin
  select * into v_rec from public.gastos_recurrentes where id = p_recurrente_id;
  if not found then
    return;
  end if;

  if v_rec.monto is not null then
    moneda := v_rec.moneda;
    monto := v_rec.monto;
    return next;
    return;
  end if;

  if v_rec.empleado_id is null then
    return;
  end if;

  select * into v_emp from public.empleados where id = v_rec.empleado_id;
  if not found then
    return;
  end if;

  moneda := v_emp.moneda;
  if v_rec.frecuencia = 'quincenal' then
    monto := round(v_emp.salario_base / 2, 6);
  else
    monto := v_emp.salario_base;
  end if;
  return next;
end;
$$;

-- ============ generar_gastos_recurrentes ============
create or replace function public.generar_gastos_recurrentes(p_hasta date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_hasta date := coalesce(p_hasta, v_hoy);
  v_total_generados integer := 0;
  v_por_recurrente jsonb := '[]'::jsonb;
  v_rec record;
  v_emp_activo boolean;
  v_monto_row record;
  v_moneda text;
  v_monto numeric(14,6);
  v_mes_cursor date;
  v_mes_limite date;
  v_p_desde date;
  v_p_hasta date;
  v_fecha_prog date;
  v_cont_plantilla integer;
  v_gen_plantilla integer;
begin
  if not public.es_admin() then
    raise exception 'Acceso no autorizado'
      using errcode = '42501';
  end if;

  if v_hasta > v_hoy then
    raise exception 'La fecha hasta no puede ser futura'
      using errcode = 'P0001', hint = 'fecha_futura';
  end if;

  for v_rec in
    select r.*
    from public.gastos_recurrentes r
    where r.activo = true
      and r.fecha_inicio <= v_hasta
    order by r.created_at asc
  loop
    -- Si es de empleado, verificar que siga activo
    if v_rec.empleado_id is not null then
      select activo into v_emp_activo from public.empleados where id = v_rec.empleado_id;
      if not coalesce(v_emp_activo, false) then
        continue;
      end if;
    end if;

    -- Obtener moneda y monto
    select * into v_monto_row from public.gasto_recurrente_monto(v_rec.id);
    if not found or v_monto_row.monto is null or v_monto_row.monto <= 0 then
      continue;
    end if;
    v_moneda := v_monto_row.moneda;
    v_monto := v_monto_row.monto;

    v_cont_plantilla := 0;
    v_gen_plantilla := 0;
    v_mes_cursor := date_trunc('month', v_rec.fecha_inicio)::date;
    v_mes_limite := date_trunc('month', least(coalesce(v_rec.fecha_fin, v_hasta), v_hasta))::date;

    while v_mes_cursor <= v_mes_limite and v_cont_plantilla < 12 loop
      if v_rec.frecuencia = 'mensual' then
        v_p_desde := v_mes_cursor;
        v_p_hasta := (v_mes_cursor + interval '1 month - 1 day')::date;
        if v_rec.dia_mes is not null then
          v_fecha_prog := make_date(
            extract(year from v_mes_cursor)::int,
            extract(month from v_mes_cursor)::int,
            v_rec.dia_mes
          );
        else
          v_fecha_prog := v_p_hasta;
        end if;

        if v_fecha_prog >= v_rec.fecha_inicio
           and v_fecha_prog <= coalesce(v_rec.fecha_fin, v_hasta)
           and v_fecha_prog <= v_hasta then
          insert into public.gastos (
            fecha, categoria_id, empleado_id, recurrente_id,
            descripcion, beneficiario, moneda, monto,
            metodo_pago, periodo_desde, periodo_hasta, estado
          ) values (
            v_fecha_prog, v_rec.categoria_id, v_rec.empleado_id, v_rec.id,
            v_rec.descripcion, v_rec.beneficiario, v_moneda, v_monto,
            v_rec.metodo_pago, v_p_desde, v_p_hasta, 'pendiente'
          )
          on conflict (recurrente_id, periodo_desde) where recurrente_id is not null do nothing;

          if found then
            v_gen_plantilla := v_gen_plantilla + 1;
            v_total_generados := v_total_generados + 1;
          end if;
          v_cont_plantilla := v_cont_plantilla + 1;
        end if;

      elsif v_rec.frecuencia = 'quincenal' then
        -- 1.ª quincena (1 a 15)
        v_p_desde := v_mes_cursor;
        v_p_hasta := make_date(
          extract(year from v_mes_cursor)::int,
          extract(month from v_mes_cursor)::int,
          15
        );
        v_fecha_prog := v_p_hasta;

        if v_fecha_prog >= v_rec.fecha_inicio
           and v_fecha_prog <= coalesce(v_rec.fecha_fin, v_hasta)
           and v_fecha_prog <= v_hasta then
          insert into public.gastos (
            fecha, categoria_id, empleado_id, recurrente_id,
            descripcion, beneficiario, moneda, monto,
            metodo_pago, periodo_desde, periodo_hasta, estado
          ) values (
            v_fecha_prog, v_rec.categoria_id, v_rec.empleado_id, v_rec.id,
            v_rec.descripcion, v_rec.beneficiario, v_moneda, v_monto,
            v_rec.metodo_pago, v_p_desde, v_p_hasta, 'pendiente'
          )
          on conflict (recurrente_id, periodo_desde) where recurrente_id is not null do nothing;

          if found then
            v_gen_plantilla := v_gen_plantilla + 1;
            v_total_generados := v_total_generados + 1;
          end if;
          v_cont_plantilla := v_cont_plantilla + 1;
        end if;

        -- 2.ª quincena (16 a fin de mes)
        if v_cont_plantilla < 12 then
          v_p_desde := make_date(
            extract(year from v_mes_cursor)::int,
            extract(month from v_mes_cursor)::int,
            16
          );
          v_p_hasta := (v_mes_cursor + interval '1 month - 1 day')::date;
          v_fecha_prog := v_p_hasta;

          if v_fecha_prog >= v_rec.fecha_inicio
             and v_fecha_prog <= coalesce(v_rec.fecha_fin, v_hasta)
             and v_fecha_prog <= v_hasta then
            insert into public.gastos (
              fecha, categoria_id, empleado_id, recurrente_id,
              descripcion, beneficiario, moneda, monto,
              metodo_pago, periodo_desde, periodo_hasta, estado
            ) values (
              v_fecha_prog, v_rec.categoria_id, v_rec.empleado_id, v_rec.id,
              v_rec.descripcion, v_rec.beneficiario, v_moneda, v_monto,
              v_rec.metodo_pago, v_p_desde, v_p_hasta, 'pendiente'
            )
            on conflict (recurrente_id, periodo_desde) where recurrente_id is not null do nothing;

            if found then
              v_gen_plantilla := v_gen_plantilla + 1;
              v_total_generados := v_total_generados + 1;
            end if;
            v_cont_plantilla := v_cont_plantilla + 1;
          end if;
        end if;
      end if;

      v_mes_cursor := (v_mes_cursor + interval '1 month')::date;
    end loop;

    if v_gen_plantilla > 0 then
      v_por_recurrente := v_por_recurrente || jsonb_build_object(
        'recurrente_id', v_rec.id,
        'nombre', v_rec.nombre,
        'generados', v_gen_plantilla
      );
    end if;
  end loop;

  return jsonb_build_object(
    'generados', v_total_generados,
    'por_recurrente', v_por_recurrente
  );
end;
$$;

grant execute on function public.generar_gastos_recurrentes(date) to authenticated;
revoke all on function public.generar_gastos_recurrentes(date) from public, anon;
