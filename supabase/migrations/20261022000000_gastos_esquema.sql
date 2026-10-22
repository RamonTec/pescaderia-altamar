-- 20-gastos (Fase A): esquema de categorías y gastos operativos.
--
-- Control de gastos operativos, NO contabilidad formal (/SPEC.md §9): sin
-- plan de cuentas, asientos, mayor ni balance. Solo admin (RLS `es_admin()`).
--
-- - `fija_auditoria()`: trigger genérico de `updated_at`/`updated_by`; no deja
--   cambiar `created_at`/`created_by`.
-- - `categorias_gasto`: catálogo con subcategoría opcional (un nivel). Siembra
--   idempotente de 7 categorías; Nómina (`clave = 'nomina'`) es de sistema.
--   Trigger `categorias_gasto_guard`.
-- - `gastos`: un gasto es una fila; escritura directa bajo RLS y triggers que
--   hacen cumplir las invariantes (sin RPC). Sin `empleado_id` (Fase B) ni
--   `recurrente_id` (Fase C). Tasa snapshot con procedencia (patrón 0019) y
--   `monto_usd` con la regla de compras (19):
--     moneda = 'usd' ? round(monto, 6) : round(monto / tasa_snapshot, 6)
-- - `gastos_guard` versión A: insert solo `confirmado`; rechaza la categoría
--   Nómina hasta la Fase B; transiciones `pendiente → confirmado | descartado`
--   y `confirmado → anulado`; un confirmado solo cambia descripción,
--   beneficiario, referencia y notas (P1 = b); terminales inmutables.
-- - Nunca `delete`: sin política y `revoke delete, truncate`.
--
-- Desvío documentado: `categorias_gasto.created_by` admite `null` (= fila
-- sembrada por esta migración, sin sesión de usuario). En las filas creadas
-- desde la app lo fija `fija_auditoria()` con `auth.uid()`.

-- ============ AUDITORÍA GENÉRICA ============
create or replace function public.fija_auditoria()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_at := new.created_at;
    new.updated_by := null;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

-- ============ categorias_gasto ============
create table public.categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
    constraint categorias_gasto_nombre_check
    check (char_length(btrim(nombre)) between 2 and 60),
  categoria_padre_id uuid references public.categorias_gasto(id),
  clave text unique,
  es_sistema boolean not null default false,
  activo boolean not null default true,
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.perfiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles(id),
  constraint categorias_gasto_no_propio_padre check (categoria_padre_id is distinct from id)
);

comment on table public.categorias_gasto is
  'Categorías de gastos operativos (20-gastos). Subcategoría = categoria_padre_id no nulo (un nivel). Nómina es de sistema. Solo admin.';
comment on column public.categorias_gasto.created_by is
  'null = sembrada por la migración 20261022000000 (sin sesión).';

create unique index categorias_gasto_nombre_uq
  on public.categorias_gasto (
    coalesce(categoria_padre_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(nombre))
  );

create index idx_categorias_gasto_padre
  on public.categorias_gasto (categoria_padre_id)
  where categoria_padre_id is not null;

create or replace function public.categorias_gasto_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_padre public.categorias_gasto%rowtype;
  v_desde_app boolean := current_user in ('authenticated', 'anon');
begin
  -- `es_sistema` y `clave` solo los fija la migración.
  if v_desde_app then
    if tg_op = 'INSERT' and (new.es_sistema or new.clave is not null) then
      raise exception 'Las categorías de sistema solo las crea el sistema'
        using errcode = 'P0001', hint = 'categoria_sistema';
    end if;
    if tg_op = 'UPDATE'
       and (new.es_sistema is distinct from old.es_sistema or new.clave is distinct from old.clave) then
      raise exception 'Las categorías de sistema solo las define el sistema'
        using errcode = 'P0001', hint = 'categoria_sistema';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.es_sistema then
    if new.nombre is distinct from old.nombre
       or new.clave is distinct from old.clave
       or new.es_sistema is distinct from old.es_sistema
       or new.activo is distinct from old.activo
       or new.categoria_padre_id is distinct from old.categoria_padre_id then
      raise exception 'La categoría % es de sistema: no se renombra, desactiva ni mueve', old.nombre
        using errcode = 'P0001', hint = 'categoria_sistema';
    end if;
  end if;

  if new.categoria_padre_id is not null then
    select * into v_padre from public.categorias_gasto where id = new.categoria_padre_id;
    if not found then
      raise exception 'La categoría padre no existe'
        using errcode = 'P0001', hint = 'categoria_nivel';
    end if;
    if v_padre.clave = 'nomina' then
      raise exception 'Nómina no admite subcategorías'
        using errcode = 'P0001', hint = 'categoria_nomina_sin_sub';
    end if;
    if v_padre.categoria_padre_id is not null then
      raise exception 'Solo hay un nivel de subcategorías'
        using errcode = 'P0001', hint = 'categoria_nivel';
    end if;
    if new.es_sistema then
      raise exception 'Una categoría de sistema no puede ser subcategoría'
        using errcode = 'P0001', hint = 'categoria_sistema';
    end if;
    if tg_op = 'UPDATE' and exists (
      select 1 from public.categorias_gasto where categoria_padre_id = new.id
    ) then
      raise exception 'Una categoría con subcategorías no puede ser subcategoría'
        using errcode = 'P0001', hint = 'categoria_nivel';
    end if;
  end if;

  new.nombre := btrim(new.nombre);
  return new;
end;
$$;

create trigger categorias_gasto_guard
  before insert or update on public.categorias_gasto
  for each row execute function public.categorias_gasto_guard();

create trigger categorias_gasto_auditoria
  before insert or update on public.categorias_gasto
  for each row execute function public.fija_auditoria();

-- Siembra idempotente por nombre (primer nivel). Corre como el dueño de la
-- migración: el guard deja fijar `clave`/`es_sistema`.
insert into public.categorias_gasto (nombre, clave, es_sistema, orden)
select s.nombre, s.clave, s.es_sistema, s.orden
from (
  values
    ('Mantenimiento', null::text, false, 10::smallint),
    ('Nómina', 'nomina', true, 20::smallint),
    ('Servicios', null, false, 30::smallint),
    ('Transporte', null, false, 40::smallint),
    ('Hielo / insumos', null, false, 50::smallint),
    ('Alquiler', null, false, 60::smallint),
    ('Otros', null, false, 90::smallint)
) as s (nombre, clave, es_sistema, orden)
where not exists (
  select 1
  from public.categorias_gasto c
  where c.categoria_padre_id is null
    and lower(btrim(c.nombre)) = lower(s.nombre)
);

-- ============ gastos ============
create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  categoria_id uuid not null references public.categorias_gasto(id),
  descripcion text not null
    constraint gastos_descripcion_check
    check (char_length(btrim(descripcion)) between 3 and 200),
  beneficiario text
    constraint gastos_beneficiario_check
    check (beneficiario is null or char_length(beneficiario) <= 120),
  moneda text not null check (moneda in ('usd', 'bs')),
  monto numeric(14,6) not null check (monto > 0),
  tasa_snapshot numeric(14,6) check (tasa_snapshot > 0),
  tasa_origen text check (tasa_origen in ('referencial', 'manual')),
  tasa_fuente text check (tasa_fuente in ('bcv', 'paralela')),
  tasa_referencial numeric(14,6),
  tasa_registrada_por uuid references public.perfiles(id),
  monto_usd numeric(14,6),
  metodo_pago text
    constraint gastos_metodo_pago_check
    check (metodo_pago is null or metodo_pago in (
      'efectivo_usd', 'efectivo_bs', 'pago_movil', 'zelle', 'transferencia', 'punto'
    )),
  referencia text
    constraint gastos_referencia_check
    check (referencia is null or char_length(referencia) <= 80),
  notas text
    constraint gastos_notas_check
    check (notas is null or char_length(notas) <= 500),
  periodo_desde date,
  periodo_hasta date,
  estado text not null default 'confirmado'
    check (estado in ('pendiente', 'confirmado', 'descartado', 'anulado')),
  confirmado_por uuid references public.perfiles(id),
  confirmado_at timestamptz,
  anulado_por uuid references public.perfiles(id),
  anulado_at timestamptz,
  motivo_anulacion text
    constraint gastos_motivo_max_check
    check (motivo_anulacion is null or char_length(motivo_anulacion) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.perfiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles(id),

  constraint gastos_tasa_coherente
    check (tasa_origen <> 'referencial' or tasa_referencial = tasa_snapshot),
  -- Un descartado viene de un pendiente y puede no tener tasa (desvío de
  -- la spec, que solo exceptuaba `pendiente`).
  constraint gastos_confirmado_completo
    check (
      estado in ('pendiente', 'descartado')
      or (tasa_snapshot is not null and tasa_origen is not null and monto_usd is not null)
    ),
  constraint gastos_monto_usd
    check (
      monto_usd is null
      or monto_usd = case moneda
        when 'usd' then round(monto, 6)
        else round(monto / tasa_snapshot, 6)
      end
    ),
  constraint gastos_periodo
    check (
      (periodo_desde is null) = (periodo_hasta is null)
      and (periodo_desde is null or periodo_desde <= periodo_hasta)
    ),
  constraint gastos_anulado_motivo
    check (estado <> 'anulado' or char_length(btrim(motivo_anulacion)) between 5 and 500)
);

comment on table public.gastos is
  'Gastos operativos (20-gastos). Totales siempre en monto_usd (snapshot, sin revaluar). Se anulan con motivo, nunca se borran. Solo admin.';
comment on column public.gastos.fecha is
  'Fecha del gasto: período en que cuenta (P2). No futura (Caracas) al crear o confirmar.';
comment on column public.gastos.monto_usd is
  'moneda = usd ? round(monto, 6) : round(monto / tasa_snapshot, 6) (regla de compras, 19).';

create index idx_gastos_fecha_confirmado on public.gastos (fecha) where estado = 'confirmado';
create index idx_gastos_categoria_fecha on public.gastos (categoria_id, fecha);
create index idx_gastos_pendiente on public.gastos (estado) where estado = 'pendiente';

-- ============ gastos_guard (versión A) ============
-- Columnas que un gasto `confirmado` puede cambiar (P1 = b) y las que mantiene
-- la base (auditoría). Se compara la fila como jsonb sin ellas: cualquier
-- columna nueva (empleado_id en B, recurrente_id en C) queda inmutable sola.
create or replace function public.gastos_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_cat public.categorias_gasto%rowtype;
  v_padre_activo boolean;
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
        elsif new.categoria_id is distinct from old.categoria_id then
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
    -- Fase A: la nómina exige empleado, que llega en la Fase B.
    if v_cat.clave = 'nomina' then
      raise exception 'Los pagos de nómina se registran con un empleado'
        using errcode = 'P0001', hint = 'categoria_nomina_requiere_empleado';
    end if;
  end if;

  return new;
end;
$$;

create trigger gastos_guard
  before insert or update on public.gastos
  for each row execute function public.gastos_guard();

create trigger gastos_auditoria
  before insert or update on public.gastos
  for each row execute function public.fija_auditoria();

create trigger gastos_tasa_registrada_por
  before insert on public.gastos
  for each row execute function public.fija_tasa_registrada_por();

-- ============ RLS (solo admin, sin delete) ============
alter table public.categorias_gasto enable row level security;
alter table public.gastos enable row level security;

create policy "categorias_gasto_select_admin" on public.categorias_gasto
  for select to authenticated using (public.es_admin());
create policy "categorias_gasto_insert_admin" on public.categorias_gasto
  for insert to authenticated with check (public.es_admin());
create policy "categorias_gasto_update_admin" on public.categorias_gasto
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy "gastos_select_admin" on public.gastos
  for select to authenticated using (public.es_admin());
create policy "gastos_insert_admin" on public.gastos
  for insert to authenticated with check (public.es_admin());
create policy "gastos_update_admin" on public.gastos
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());
-- Sin política de delete: los gastos se anulan, no se borran.

grant select, insert, update on public.categorias_gasto to authenticated;
grant select, insert, update on public.gastos to authenticated;
revoke all on public.categorias_gasto from anon;
revoke all on public.gastos from anon;
revoke delete, truncate on public.categorias_gasto from authenticated;
revoke delete, truncate on public.gastos from authenticated;
