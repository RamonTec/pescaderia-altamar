-- 21-cotizaciones (Fase A): esquema, guard, RPC de guardado y listado.
--
-- Una cotización es un documento comercial previo a la venta: no mueve stock,
-- no reserva lotes, no genera deuda ni factura y no guarda costos. Solo USD
-- (P1: sin tasas ni equivalente en Bs). Admin y operador (P4).
--
-- - `config_negocio`: `cotizacion_validez_dias` (default de validez) y
--   `cotizacion_terminos` (condiciones por defecto). Tarea agregada en 04.
-- - `cotizaciones` + `cotizacion_items`: sin `token_*` (Fase C) ni
--   `pedido_id` (Fase D). Numeración por secuencia (P3, patrón 0015).
-- - Escritura de cabecera + líneas solo por `guardar_cotizacion` (security
--   definer, atómica, calcula los importes en SQL). Los cambios de estado son
--   `update` de una fila, controlados por `cotizaciones_guard`.
-- - `vencida` es derivada (P5): `estado in ('borrador','enviada') and
--   fecha_vencimiento < hoy (Caracas)`. Sin cron.
-- - Importes (misma regla que `src/lib/cotizaciones/totales.ts`):
--     subtotal_linea = round(peso_kg × precio_usd_kg, 6)
--     subtotal       = Σ subtotal_linea
--     iva            = round((subtotal − descuento) × iva_pct / 100, 6)
--     total          = round(subtotal − descuento + iva, 6)
--
-- Desvío documentado: `cotizaciones_usuarios_view` (sin security_invoker)
-- expone solo los nombres de quien creó, envió, respondió, anuló o editó cada
-- cotización: la RLS de `perfiles` solo deja al operador leer su propio
-- perfil y el historial de la ficha (P4: también para el operador) los
-- necesita. Solo `authenticated`.

-- ============ config_negocio (tarea agregada en 04-inventario) ============
alter table public.config_negocio
  add column if not exists cotizacion_validez_dias smallint not null default 7
    constraint config_negocio_cotizacion_validez_check
    check (cotizacion_validez_dias between 1 and 90),
  add column if not exists cotizacion_terminos text
    constraint config_negocio_cotizacion_terminos_check
    check (cotizacion_terminos is null or char_length(cotizacion_terminos) <= 2000);

comment on column public.config_negocio.cotizacion_validez_dias is
  'Días de validez por defecto de una cotización nueva (21-cotizaciones).';
comment on column public.config_negocio.cotizacion_terminos is
  'Condiciones por defecto que se precargan en cada cotización (21-cotizaciones).';

-- ============ cotizaciones ============
create sequence if not exists public.cotizaciones_numero_seq;

create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique default nextval('public.cotizaciones_numero_seq'),
  fecha date not null default ((now() at time zone 'America/Caracas')::date),
  validez_dias smallint not null
    constraint cotizaciones_validez_check check (validez_dias between 1 and 90),
  fecha_vencimiento date not null,
  cliente_id uuid references public.clientes(id),
  cliente_nombre text
    constraint cotizaciones_cliente_nombre_check
    check (cliente_nombre is null or char_length(btrim(cliente_nombre)) between 2 and 120),
  cliente_telefono text
    constraint cotizaciones_cliente_telefono_check
    check (cliente_telefono is null or char_length(cliente_telefono) <= 20),
  estado text not null default 'borrador'
    constraint cotizaciones_estado_check
    check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada', 'anulada')),
  iva_pct numeric(5,2) not null
    constraint cotizaciones_iva_pct_check check (iva_pct between 0 and 100),
  subtotal_usd numeric(14,6) not null
    constraint cotizaciones_subtotal_check check (subtotal_usd >= 0),
  descuento_usd numeric(14,6) not null default 0,
  iva_usd numeric(14,6) not null
    constraint cotizaciones_iva_check check (iva_usd >= 0),
  total_usd numeric(14,6) not null,
  notas_cliente text
    constraint cotizaciones_notas_cliente_check
    check (notas_cliente is null or char_length(notas_cliente) <= 1000),
  notas_internas text
    constraint cotizaciones_notas_internas_check
    check (notas_internas is null or char_length(notas_internas) <= 500),
  terminos text
    constraint cotizaciones_terminos_check
    check (terminos is null or char_length(terminos) <= 2000),
  enviada_at timestamptz,
  enviada_por uuid references public.perfiles(id),
  respondida_at timestamptz,
  respondida_por uuid references public.perfiles(id),
  motivo_rechazo text
    constraint cotizaciones_motivo_rechazo_check
    check (motivo_rechazo is null or char_length(motivo_rechazo) <= 500),
  anulada_at timestamptz,
  anulada_por uuid references public.perfiles(id),
  motivo_anulacion text
    constraint cotizaciones_motivo_anulacion_check
    check (motivo_anulacion is null or char_length(motivo_anulacion) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.perfiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles(id),

  constraint cotizaciones_cliente check (
    (cliente_id is not null and cliente_nombre is null and cliente_telefono is null)
    or (cliente_id is null and cliente_nombre is not null)
  ),
  constraint cotizaciones_vencimiento check (fecha_vencimiento = fecha + validez_dias),
  constraint cotizaciones_descuento check (descuento_usd >= 0 and descuento_usd <= subtotal_usd),
  constraint cotizaciones_total check (total_usd = round(subtotal_usd - descuento_usd + iva_usd, 6))
);

alter sequence public.cotizaciones_numero_seq owned by public.cotizaciones.numero;

comment on table public.cotizaciones is
  'Cotizaciones (21): documento previo a la venta, solo USD/kg. Escritura de cabecera + líneas solo por guardar_cotizacion; estados por update bajo cotizaciones_guard. vencida es derivada.';
comment on column public.cotizaciones.numero is 'Correlativo (P3); se muestra como COT-000123. Los anulados conservan su número.';
comment on column public.cotizaciones.notas_internas is 'Nunca sale en el PDF ni en el enlace público.';

create index idx_cotizaciones_fecha on public.cotizaciones (fecha desc);
create index idx_cotizaciones_estado_venc on public.cotizaciones (estado, fecha_vencimiento);
create index idx_cotizaciones_cliente on public.cotizaciones (cliente_id) where cliente_id is not null;

-- ============ cotizacion_items ============
create table public.cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  orden smallint not null constraint cotizacion_items_orden_check check (orden >= 1),
  producto_id uuid not null references public.productos(id),
  producto_nombre text not null,
  peso_kg numeric(12,3) not null constraint cotizacion_items_peso_check check (peso_kg > 0),
  precio_usd_kg numeric(14,6) not null constraint cotizacion_items_precio_check check (precio_usd_kg >= 0),
  subtotal_usd numeric(14,6) not null,
  nota text constraint cotizacion_items_nota_check check (nota is null or char_length(nota) <= 200),
  constraint cotizacion_items_subtotal check (subtotal_usd = round(peso_kg * precio_usd_kg, 6))
);

comment on column public.cotizacion_items.producto_nombre is
  'Snapshot del nombre del producto al guardar: el documento no cambia si se renombra.';

create unique index cotizacion_items_orden_uq on public.cotizacion_items (cotizacion_id, orden);
create index idx_cotizacion_items_producto on public.cotizacion_items (producto_id);

-- ============ cotizaciones_guard (versión A) ============
-- Transiciones: borrador → enviada | aceptada | rechazada | anulada;
-- enviada → aceptada | rechazada | anulada; aceptada | rechazada → anulada.
-- Las columnas comerciales solo las fija `guardar_cotizacion` (dentro de la
-- RPC `current_user` no es `authenticated`). Terminales inmutables.
create or replace function public.cotizaciones_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_desde_app boolean := current_user in ('authenticated', 'anon');
  v_comerciales text[] := array[
    'fecha', 'validez_dias', 'fecha_vencimiento', 'cliente_id', 'cliente_nombre',
    'cliente_telefono', 'iva_pct', 'subtotal_usd', 'descuento_usd', 'iva_usd',
    'total_usd', 'notas_cliente', 'notas_internas', 'terminos'
  ];
  -- Columnas que no cuentan como "dato" al comparar: auditoría, estado y la
  -- trazabilidad que fija este trigger.
  v_ignoradas text[] := array[
    'updated_at', 'updated_by', 'created_at', 'created_by', 'estado',
    'motivo_rechazo', 'motivo_anulacion', 'enviada_at', 'enviada_por',
    'respondida_at', 'respondida_por', 'anulada_at', 'anulada_por'
  ];
  v_nuevo jsonb;
  v_viejo jsonb;
  v_cambios text[];
  v_cambia_estado boolean := new.estado is distinct from old.estado;
begin
  if new.numero is distinct from old.numero or new.id is distinct from old.id then
    raise exception 'El número de la cotización no cambia'
      using errcode = 'P0001', hint = 'cotizacion_inmutable';
  end if;

  -- Trazabilidad: la fija este trigger, nunca el cliente.
  new.enviada_at := old.enviada_at;
  new.enviada_por := old.enviada_por;
  new.respondida_at := old.respondida_at;
  new.respondida_por := old.respondida_por;
  new.anulada_at := old.anulada_at;
  new.anulada_por := old.anulada_por;
  if not (v_cambia_estado and new.estado = 'rechazada') then
    new.motivo_rechazo := old.motivo_rechazo;
  else
    new.motivo_rechazo := nullif(btrim(coalesce(new.motivo_rechazo, '')), '');
  end if;
  if not (v_cambia_estado and new.estado = 'anulada') then
    new.motivo_anulacion := old.motivo_anulacion;
  else
    new.motivo_anulacion := nullif(btrim(coalesce(new.motivo_anulacion, '')), '');
  end if;

  v_nuevo := to_jsonb(new) - v_ignoradas;
  v_viejo := to_jsonb(old) - v_ignoradas;
  select coalesce(array_agg(k), '{}')
    into v_cambios
    from jsonb_object_keys(v_nuevo) as k
   where v_nuevo -> k is distinct from v_viejo -> k;

  if old.estado in ('aceptada', 'rechazada', 'anulada') and cardinality(v_cambios) > 0 then
    raise exception 'Una cotización % no se modifica: duplícala para cambiarla', old.estado
      using errcode = 'P0001', hint = 'cotizacion_inmutable';
  end if;

  if v_desde_app and v_cambios && v_comerciales then
    raise exception 'Los datos de la cotización se guardan con guardar_cotizacion'
      using errcode = 'P0001', hint = 'usar_guardar_cotizacion';
  end if;

  if v_desde_app and cardinality(v_cambios) > 0 then
    raise exception 'Estos datos de la cotización no se modifican'
      using errcode = 'P0001', hint = 'cotizacion_inmutable';
  end if;

  if v_cambia_estado then
    if not (
      (old.estado = 'borrador' and new.estado in ('enviada', 'aceptada', 'rechazada', 'anulada'))
      or (old.estado = 'enviada' and new.estado in ('aceptada', 'rechazada', 'anulada'))
      or (old.estado in ('aceptada', 'rechazada') and new.estado = 'anulada')
    ) then
      raise exception 'Transición de estado no permitida: % → %', old.estado, new.estado
        using errcode = 'P0001', hint = 'transicion_invalida';
    end if;

    if new.estado = 'aceptada' and new.fecha_vencimiento < v_hoy then
      raise exception 'La cotización está vencida: renuévala antes de marcarla aceptada'
        using errcode = 'P0001', hint = 'cotizacion_vencida';
    end if;

    if new.estado = 'enviada' and old.enviada_at is null then
      new.enviada_at := now();
      new.enviada_por := auth.uid();
    elsif new.estado in ('aceptada', 'rechazada') then
      new.respondida_at := now();
      new.respondida_por := auth.uid();
    elsif new.estado = 'anulada' then
      new.anulada_at := now();
      new.anulada_por := auth.uid();
    end if;
  end if;

  return new;
end;
$$;

create trigger cotizaciones_guard
  before update on public.cotizaciones
  for each row execute function public.cotizaciones_guard();

create trigger cotizaciones_auditoria
  before insert or update on public.cotizaciones
  for each row execute function public.fija_auditoria();

-- ============ RPC guardar_cotizacion ============
-- p_cabecera: { fecha, validez_dias, cliente_id | (cliente_nombre, cliente_telefono),
--               iva_pct, descuento_usd, notas_cliente, notas_internas, terminos }
-- p_items:    [{ producto_id, peso_kg, precio_usd_kg, nota }]  (en orden)
create or replace function public.guardar_cotizacion(
  p_id uuid,
  p_cabecera jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_id uuid := p_id;
  v_actual public.cotizaciones%rowtype;
  v_fecha date;
  v_validez integer;
  v_cliente uuid;
  v_cliente_nombre text;
  v_cliente_tel text;
  v_iva_pct numeric(5,2);
  v_descuento numeric(14,6);
  v_subtotal numeric(14,6) := 0;
  v_iva numeric(14,6);
  v_total numeric(14,6);
  v_n integer;
  v_item jsonb;
  v_idx bigint;
  v_prod record;
  v_peso numeric(12,3);
  v_precio numeric(14,6);
  v_nota text;
begin
  if v_uid is null or not exists (select 1 from public.perfiles where id = v_uid) then
    raise exception 'Inicia sesión para guardar cotizaciones' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto'
      using errcode = 'P0001', hint = 'sin_lineas';
  end if;
  v_n := jsonb_array_length(p_items);
  if v_n > 50 then
    raise exception 'Una cotización admite hasta 50 líneas'
      using errcode = 'P0001', hint = 'demasiadas_lineas';
  end if;

  if p_id is not null then
    select * into v_actual from public.cotizaciones where id = p_id for update;
    if not found then
      raise exception 'La cotización no existe'
        using errcode = 'P0001', hint = 'cotizacion_inexistente';
    end if;
    if v_actual.estado not in ('borrador', 'enviada') then
      raise exception 'Una cotización % no se modifica: duplícala para cambiarla', v_actual.estado
        using errcode = 'P0001', hint = 'cotizacion_inmutable';
    end if;
  end if;

  v_fecha := coalesce(nullif(p_cabecera ->> 'fecha', '')::date, v_hoy);
  if v_fecha > v_hoy then
    raise exception 'La fecha de la cotización no puede ser futura'
      using errcode = 'P0001', hint = 'fecha_futura';
  end if;

  v_validez := nullif(p_cabecera ->> 'validez_dias', '')::integer;
  if v_validez is null or v_validez not between 1 and 90 then
    raise exception 'La validez debe estar entre 1 y 90 días'
      using errcode = 'P0001', hint = 'validez_invalida';
  end if;

  v_cliente := nullif(p_cabecera ->> 'cliente_id', '')::uuid;
  v_cliente_nombre := nullif(btrim(coalesce(p_cabecera ->> 'cliente_nombre', '')), '');
  v_cliente_tel := nullif(btrim(coalesce(p_cabecera ->> 'cliente_telefono', '')), '');
  if v_cliente is not null then
    if not exists (select 1 from public.clientes where id = v_cliente and activo) then
      raise exception 'El cliente no existe o está inactivo'
        using errcode = 'P0001', hint = 'cliente_requerido';
    end if;
    v_cliente_nombre := null;
    v_cliente_tel := null;
  elsif v_cliente_nombre is null or char_length(v_cliente_nombre) not between 2 and 120 then
    raise exception 'Elige un cliente registrado o escribe el nombre del cliente'
      using errcode = 'P0001', hint = 'cliente_requerido';
  end if;

  v_iva_pct := nullif(p_cabecera ->> 'iva_pct', '')::numeric;
  if v_iva_pct is null or v_iva_pct not between 0 and 100 then
    raise exception 'El IVA debe estar entre 0 y 100 %%'
      using errcode = 'P0001', hint = 'iva_invalido';
  end if;

  v_descuento := round(coalesce(nullif(p_cabecera ->> 'descuento_usd', '')::numeric, 0), 6);
  if v_descuento < 0 then
    raise exception 'El descuento no puede ser negativo'
      using errcode = 'P0001', hint = 'descuento_mayor_subtotal';
  end if;

  -- Pasada 1: valida las líneas y calcula el subtotal.
  for v_item, v_idx in select e, i from jsonb_array_elements(p_items) with ordinality as t(e, i) loop
    select id, nombre, activo into v_prod
      from public.productos
     where id = nullif(v_item ->> 'producto_id', '')::uuid;
    if not found or not v_prod.activo then
      raise exception 'El producto de la línea % no existe o está inactivo', v_idx
        using errcode = 'P0001', hint = 'producto_inactivo',
              detail = format('items.%s.producto_id', v_idx - 1);
    end if;
    v_peso := round(nullif(v_item ->> 'peso_kg', '')::numeric, 3);
    if v_peso is null or v_peso <= 0 then
      raise exception 'El peso de la línea % debe ser mayor que 0', v_idx
        using errcode = 'P0001', hint = 'peso_invalido',
              detail = format('items.%s.peso_kg', v_idx - 1);
    end if;
    v_precio := round(nullif(v_item ->> 'precio_usd_kg', '')::numeric, 6);
    if v_precio is null or v_precio < 0 then
      raise exception 'El precio de la línea % no puede ser negativo', v_idx
        using errcode = 'P0001', hint = 'precio_invalido',
              detail = format('items.%s.precio_usd_kg', v_idx - 1);
    end if;
    v_subtotal := v_subtotal + round(v_peso * v_precio, 6);
  end loop;

  if v_descuento > v_subtotal then
    raise exception 'El descuento no puede ser mayor que el subtotal'
      using errcode = 'P0001', hint = 'descuento_mayor_subtotal';
  end if;

  v_iva := round((v_subtotal - v_descuento) * v_iva_pct / 100, 6);
  v_total := round(v_subtotal - v_descuento + v_iva, 6);

  if v_id is null then
    insert into public.cotizaciones (
      fecha, validez_dias, fecha_vencimiento, cliente_id, cliente_nombre, cliente_telefono,
      iva_pct, subtotal_usd, descuento_usd, iva_usd, total_usd,
      notas_cliente, notas_internas, terminos
    ) values (
      v_fecha, v_validez, v_fecha + v_validez, v_cliente, v_cliente_nombre, v_cliente_tel,
      v_iva_pct, v_subtotal, v_descuento, v_iva, v_total,
      nullif(btrim(coalesce(p_cabecera ->> 'notas_cliente', '')), ''),
      nullif(btrim(coalesce(p_cabecera ->> 'notas_internas', '')), ''),
      nullif(btrim(coalesce(p_cabecera ->> 'terminos', '')), '')
    )
    returning id into v_id;
  else
    update public.cotizaciones set
      fecha = v_fecha,
      validez_dias = v_validez,
      fecha_vencimiento = v_fecha + v_validez,
      cliente_id = v_cliente,
      cliente_nombre = v_cliente_nombre,
      cliente_telefono = v_cliente_tel,
      iva_pct = v_iva_pct,
      subtotal_usd = v_subtotal,
      descuento_usd = v_descuento,
      iva_usd = v_iva,
      total_usd = v_total,
      notas_cliente = nullif(btrim(coalesce(p_cabecera ->> 'notas_cliente', '')), ''),
      notas_internas = nullif(btrim(coalesce(p_cabecera ->> 'notas_internas', '')), ''),
      terminos = nullif(btrim(coalesce(p_cabecera ->> 'terminos', '')), '')
    where id = v_id;
    delete from public.cotizacion_items where cotizacion_id = v_id;
  end if;

  -- Pasada 2: reemplaza las líneas (snapshot del nombre del producto).
  for v_item, v_idx in select e, i from jsonb_array_elements(p_items) with ordinality as t(e, i) loop
    v_peso := round((v_item ->> 'peso_kg')::numeric, 3);
    v_precio := round((v_item ->> 'precio_usd_kg')::numeric, 6);
    v_nota := nullif(btrim(coalesce(v_item ->> 'nota', '')), '');
    insert into public.cotizacion_items (
      cotizacion_id, orden, producto_id, producto_nombre, peso_kg, precio_usd_kg, subtotal_usd, nota
    )
    select v_id, v_idx, p.id, p.nombre, v_peso, v_precio, round(v_peso * v_precio, 6), v_nota
      from public.productos p
     where p.id = (v_item ->> 'producto_id')::uuid;
  end loop;

  return v_id;
end;
$$;

-- ============ Vistas ============
create view public.cotizaciones_listado_view
with (security_invoker = true)
as
select
  c.id,
  c.numero,
  c.fecha,
  c.fecha_vencimiento,
  c.estado,
  case
    when c.estado in ('borrador', 'enviada')
         and c.fecha_vencimiento < (now() at time zone 'America/Caracas')::date
      then 'vencida'
    else c.estado
  end as estado_efectivo,
  c.cliente_id,
  coalesce(cl.nombre, c.cliente_nombre) as cliente,
  case when c.cliente_id is not null then cl.telefono else c.cliente_telefono end as telefono,
  c.total_usd,
  (select count(*) from public.cotizacion_items i where i.cotizacion_id = c.id)::integer as n_lineas,
  c.enviada_at,
  c.updated_at,
  -- Búsqueda: nombre sin acentos en minúsculas + dígitos del teléfono.
  translate(lower(coalesce(cl.nombre, c.cliente_nombre, '')), 'áéíóúüñ', 'aeiouun')
    || ' ' || regexp_replace(
      coalesce(case when c.cliente_id is not null then cl.telefono else c.cliente_telefono end, ''),
      '\D', '', 'g'
    ) as busqueda
from public.cotizaciones c
left join public.clientes cl on cl.id = c.cliente_id;

comment on view public.cotizaciones_listado_view is
  'Listado de cotizaciones (21) con estado_efectivo (vencida derivada, hoy de Caracas). security_invoker: hereda la RLS.';

-- Nombres de los usuarios del historial (ver desvío en la cabecera).
create view public.cotizaciones_usuarios_view
as
select
  c.id,
  pc.nombre as creado_por_nombre,
  pe.nombre as enviada_por_nombre,
  pr.nombre as respondida_por_nombre,
  pa.nombre as anulada_por_nombre,
  pu.nombre as actualizado_por_nombre
from public.cotizaciones c
left join public.perfiles pc on pc.id = c.created_by
left join public.perfiles pe on pe.id = c.enviada_por
left join public.perfiles pr on pr.id = c.respondida_por
left join public.perfiles pa on pa.id = c.anulada_por
left join public.perfiles pu on pu.id = c.updated_by;

-- ============ RLS (admin y operador, P4) ============
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;

create policy "cotizaciones_select_auth" on public.cotizaciones
  for select to authenticated using (true);
create policy "cotizaciones_update_auth" on public.cotizaciones
  for update to authenticated using (true) with check (true);
-- Sin insert ni delete directos: el alta va por guardar_cotizacion.

create policy "cotizacion_items_select_auth" on public.cotizacion_items
  for select to authenticated using (true);
-- Sin insert/update/delete directos: las líneas las reemplaza la RPC.

revoke all on public.cotizaciones from anon;
revoke all on public.cotizacion_items from anon;
revoke all on public.cotizaciones_listado_view from anon;
revoke all on public.cotizaciones_usuarios_view from anon;
revoke all on sequence public.cotizaciones_numero_seq from anon;

grant select, update on public.cotizaciones to authenticated;
revoke insert, delete, truncate on public.cotizaciones from authenticated;
grant select on public.cotizacion_items to authenticated;
revoke insert, update, delete, truncate on public.cotizacion_items from authenticated;
grant select on public.cotizaciones_listado_view to authenticated;
grant select on public.cotizaciones_usuarios_view to authenticated;

revoke all on function public.guardar_cotizacion(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_cotizacion(uuid, jsonb, jsonb) to authenticated;
