-- 21-cotizaciones (Fase C): enlace público con token y RPC anónima.
--
-- - `cotizaciones.token_publico` (32 caracteres base64url, generado en el
--   servidor con `crypto.randomBytes(24)`), `token_generado_at/_por`. `null` =
--   sin enlace o revocado. Check `cotizaciones_token_estado`: una anulada
--   nunca tiene token.
-- - `cotizaciones_guard` (versión C): conserva todo lo de la versión A; el
--   token se crea, regenera o revoca en borrador/enviada/aceptada/rechazada,
--   nunca en anulada; anular lo pone en `null`; `token_generado_*` los fija
--   el trigger.
-- - `cotizaciones_listado_view` suma `tiene_enlace` y
--   `cotizaciones_usuarios_view` suma `token_generado_por_nombre` (al final).
-- - `cotizacion_publica(text)`: ÚNICA puerta anónima (P7). La tabla sigue sin
--   ningún permiso para `anon`. Siempre devuelve `negocio` (contacto) y un
--   `resultado`:
--     no_disponible: token de otra longitud, inexistente (incluye revocado o
--                    regenerado), borrador o anulada; sin ningún otro dato.
--     vencida:       `fecha_vencimiento < hoy (Caracas)`, en cualquier otro
--                    estado; solo el número (sin gracia, P7).
--     disponible:    el resto; solo campos públicos (nunca notas internas,
--                    ids, usuarios ni el teléfono del cliente). Del negocio,
--                    además: razón social, RIF, dirección e instrucciones de
--                    pago (las mismas que imprime el PDF interno).

-- ============ Columnas ============
alter table public.cotizaciones
  add column token_publico text unique
    constraint cotizaciones_token_publico_check check (token_publico is null or char_length(token_publico) = 32),
  add column token_generado_at timestamptz,
  add column token_generado_por uuid references public.perfiles(id),
  add constraint cotizaciones_token_estado check (token_publico is null or estado <> 'anulada');

comment on column public.cotizaciones.token_publico is
  'Token del enlace público /c/[token] (P7). null = sin enlace o revocado. Solo se lee por cotizacion_publica().';

-- ============ cotizaciones_guard (versión C) ============
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
    'respondida_at', 'respondida_por', 'anulada_at', 'anulada_por',
    -- Fase C: el enlace se gestiona aparte (abajo); no es un dato comercial.
    'token_publico', 'token_generado_at', 'token_generado_por'
  ];
  v_cambia_token boolean := new.token_publico is distinct from old.token_publico;
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

  -- Enlace público (Fase C): se crea, regenera o revoca en borrador, enviada,
  -- aceptada o rechazada; nunca en una anulada. `token_generado_*` los fija
  -- este trigger.
  if v_cambia_token and old.estado = 'anulada' then
    raise exception 'Una cotización anulada no tiene enlace público'
      using errcode = 'P0001', hint = 'cotizacion_inmutable';
  end if;
  if v_cambia_token and new.token_publico is not null then
    new.token_generado_at := now();
    new.token_generado_por := auth.uid();
  elsif v_cambia_token then
    new.token_generado_at := null;
    new.token_generado_por := null;
  else
    new.token_generado_at := old.token_generado_at;
    new.token_generado_por := old.token_generado_por;
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
      -- Anular revoca el enlace (P7).
      new.token_publico := null;
      new.token_generado_at := null;
      new.token_generado_por := null;
    end if;
  end if;

  return new;
end;
$$;


-- ============ Vista del listado (+ tiene_enlace) ============
create or replace view public.cotizaciones_listado_view
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
    ) as busqueda,
  -- Fase C: ícono de enlace activo en el listado.
  (c.token_publico is not null) as tiene_enlace
from public.cotizaciones c
left join public.clientes cl on cl.id = c.cliente_id;


-- Nombres del historial (+ quién generó el enlace), mismo desvío que en A.
create or replace view public.cotizaciones_usuarios_view
as
select
  c.id,
  pc.nombre as creado_por_nombre,
  pe.nombre as enviada_por_nombre,
  pr.nombre as respondida_por_nombre,
  pa.nombre as anulada_por_nombre,
  pu.nombre as actualizado_por_nombre,
  pt.nombre as token_generado_por_nombre
from public.cotizaciones c
left join public.perfiles pc on pc.id = c.created_by
left join public.perfiles pe on pe.id = c.enviada_por
left join public.perfiles pr on pr.id = c.respondida_por
left join public.perfiles pa on pa.id = c.anulada_por
left join public.perfiles pu on pu.id = c.updated_by
left join public.perfiles pt on pt.id = c.token_generado_por;

revoke all on public.cotizaciones_usuarios_view from anon;
grant select on public.cotizaciones_usuarios_view to authenticated;

-- ============ RPC cotizacion_publica ============
create or replace function public.cotizacion_publica(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_cfg public.config_negocio%rowtype;
  v_negocio jsonb;
  v_c public.cotizaciones%rowtype;
  v_cliente jsonb;
  v_items jsonb;
begin
  select * into v_cfg from public.config_negocio where id = 1;
  v_negocio := jsonb_build_object('nombre_comercial', v_cfg.nombre_comercial, 'telefono', v_cfg.telefono);

  if p_token is null or char_length(p_token) <> 32 then
    return jsonb_build_object('resultado', 'no_disponible', 'negocio', v_negocio);
  end if;

  select * into v_c from public.cotizaciones where token_publico = p_token;
  if not found or v_c.estado in ('borrador', 'anulada') then
    return jsonb_build_object('resultado', 'no_disponible', 'negocio', v_negocio);
  end if;

  if v_c.fecha_vencimiento < v_hoy then
    return jsonb_build_object(
      'resultado', 'vencida',
      'negocio', v_negocio,
      'cotizacion', jsonb_build_object('numero', v_c.numero)
    );
  end if;

  if v_c.cliente_id is not null then
    select jsonb_build_object('nombre', cl.nombre, 'rif_ci', cl.rif_ci)
      into v_cliente
      from public.clientes cl
     where cl.id = v_c.cliente_id;
  else
    v_cliente := jsonb_build_object('nombre', v_c.cliente_nombre, 'rif_ci', null);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'producto_nombre', i.producto_nombre,
           'peso_kg', i.peso_kg,
           'precio_usd_kg', i.precio_usd_kg,
           'subtotal_usd', i.subtotal_usd,
           'nota', i.nota
         ) order by i.orden), '[]'::jsonb)
    into v_items
    from public.cotizacion_items i
   where i.cotizacion_id = v_c.id;

  return jsonb_build_object(
    'resultado', 'disponible',
    'negocio', v_negocio || jsonb_build_object(
      'razon_social', v_cfg.razon_social,
      'rif', v_cfg.rif,
      'direccion', v_cfg.direccion,
      'instrucciones_pago', v_cfg.instrucciones_pago
    ),
    'cotizacion', jsonb_build_object(
      'numero', v_c.numero,
      'fecha', v_c.fecha,
      'fecha_vencimiento', v_c.fecha_vencimiento,
      'estado_publico', case v_c.estado when 'aceptada' then 'aceptada' when 'rechazada' then 'rechazada' else 'vigente' end,
      'cliente', v_cliente,
      'items', v_items,
      'subtotal_usd', v_c.subtotal_usd,
      'descuento_usd', v_c.descuento_usd,
      'iva_pct', v_c.iva_pct,
      'iva_usd', v_c.iva_usd,
      'total_usd', v_c.total_usd,
      'notas_cliente', v_c.notas_cliente,
      'terminos', v_c.terminos,
      'updated_at', v_c.updated_at
    )
  );
end;
$$;

comment on function public.cotizacion_publica(text) is
  'Única lectura anónima de cotizaciones (21, P7): disponible / vencida / no_disponible. Nunca notas internas, ids, usuarios ni teléfono del cliente.';

revoke all on function public.cotizacion_publica(text) from public;
grant execute on function public.cotizacion_publica(text) to anon, authenticated;

-- La tabla y la vista siguen sin permisos para anon (revocados en la Fase A).
revoke all on public.cotizaciones from anon;
revoke all on public.cotizaciones_listado_view from anon;
grant select on public.cotizaciones_listado_view to authenticated;
