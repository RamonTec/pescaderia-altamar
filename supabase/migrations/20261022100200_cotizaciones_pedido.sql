-- 21-cotizaciones (Fase D, P8): convertir una cotización aceptada en pedido.
--
-- - `cotizaciones.pedido_id` (único, FK `pedidos`): el pedido creado desde la
--   cotización. No cambia `pedidos` ni `pedido_items`.
-- - `cotizaciones_guard` (versión D): conserva todo lo de las versiones A y C;
--   `pedido_id` se fija una sola vez y solo en una aceptada con cliente
--   registrado; una aceptada con pedido no se anula (se anula el pedido en 05).
-- - `cotizaciones_listado_view` suma `pedido_id` (al final).
-- - `convertir_cotizacion_en_pedido(uuid, date)`: security invoker (las RLS
--   de `pedidos` aplican como en 05). En una transacción: acepta una enviada
--   vigente si hace falta, valida cliente registrado y productos activos,
--   crea el pedido con `registrar_pedido` (05; peso estimado = kg y el
--   precio pactado de cada línea) y fija `pedido_id`. Decisión al ejecutar
--   (tarea 21): como `crearPedido` ya es la RPC `registrar_pedido`, la
--   conversión es una sola RPC atómica (sin pedido huérfano si el enlace falla).

-- ============ Columna ============
alter table public.cotizaciones
  add column pedido_id uuid unique references public.pedidos(id);

comment on column public.cotizaciones.pedido_id is
  'Pedido creado desde esta cotización (21, Fase D). Se fija una sola vez, solo en aceptada con cliente registrado.';

-- ============ cotizaciones_guard (versión D) ============
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
    'token_publico', 'token_generado_at', 'token_generado_por',
    -- Fase D: el pedido se enlaza aparte (abajo).
    'pedido_id'
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

  -- Conversión en pedido (Fase D, P8): `pedido_id` se fija una sola vez y
  -- solo en una aceptada con cliente registrado.
  if new.pedido_id is distinct from old.pedido_id then
    if old.pedido_id is not null then
      raise exception 'La cotización ya se convirtió en pedido'
        using errcode = 'P0001', hint = 'cotizacion_convertida';
    end if;
    if new.estado <> 'aceptada' or new.cliente_id is null then
      raise exception 'Solo una cotización aceptada con cliente registrado se convierte en pedido'
        using errcode = 'P0001', hint = 'pedido_requiere_aceptada';
    end if;
  end if;

  if v_cambia_estado then
    if new.estado = 'anulada' and old.pedido_id is not null then
      raise exception 'La cotización ya se convirtió en pedido: anula el pedido en Pedidos'
        using errcode = 'P0001', hint = 'cotizacion_convertida';
    end if;
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

-- ============ Vista del listado (+ pedido_id) ============
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
  (c.token_publico is not null) as tiene_enlace,
  -- Fase D: pedido creado desde la cotización.
  c.pedido_id
from public.cotizaciones c
left join public.clientes cl on cl.id = c.cliente_id;

-- ============ RPC convertir_cotizacion_en_pedido ============
create or replace function public.convertir_cotizacion_en_pedido(
  p_id uuid,
  p_fecha_entrega date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_c public.cotizaciones%rowtype;
  v_pedido uuid := gen_random_uuid();
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para convertir cotizaciones' using errcode = '42501';
  end if;
  if p_fecha_entrega is null then
    raise exception 'Indica la fecha de entrega del pedido'
      using errcode = 'P0001', hint = 'fecha_entrega_requerida';
  end if;

  select * into v_c from public.cotizaciones where id = p_id for update;
  if not found then
    raise exception 'La cotización no existe' using errcode = 'P0001', hint = 'cotizacion_inexistente';
  end if;
  if v_c.pedido_id is not null then
    raise exception 'La cotización ya se convirtió en pedido'
      using errcode = 'P0001', hint = 'cotizacion_convertida';
  end if;
  if v_c.cliente_id is null then
    raise exception 'Registra el cliente para convertir la cotización en pedido'
      using errcode = 'P0001', hint = 'cliente_requerido';
  end if;
  if v_c.estado = 'enviada' and v_c.fecha_vencimiento >= v_hoy then
    -- Una enviada vigente se acepta al convertirla (lo registra el guard).
    update public.cotizaciones set estado = 'aceptada' where id = p_id;
    v_c.estado := 'aceptada';
  end if;
  if v_c.estado <> 'aceptada' then
    raise exception 'Solo una cotización aceptada (o enviada y vigente) se convierte en pedido'
      using errcode = 'P0001', hint = 'pedido_requiere_aceptada';
  end if;
  if exists (
    select 1
      from public.cotizacion_items i
      join public.productos p on p.id = i.producto_id
     where i.cotizacion_id = p_id and not p.activo
  ) then
    raise exception 'La cotización tiene productos inactivos: duplícala y cámbialos'
      using errcode = 'P0001', hint = 'producto_inactivo';
  end if;

  select jsonb_agg(jsonb_build_object(
           'producto_id', i.producto_id,
           'peso_estimado_kg', i.peso_kg,
           'precio_usd_kg', i.precio_usd_kg
         ) order by i.orden)
    into v_items
    from public.cotizacion_items i
   where i.cotizacion_id = p_id;

  perform public.registrar_pedido(
    jsonb_build_object(
      'id', v_pedido,
      'cliente_id', v_c.cliente_id,
      'fecha', v_hoy,
      'fecha_entrega', p_fecha_entrega,
      'estado', 'pendiente',
      'notas', 'Desde la cotización COT-' || lpad(v_c.numero::text, 6, '0')
    ),
    v_items
  );

  update public.cotizaciones set pedido_id = v_pedido where id = p_id;
  return v_pedido;
end;
$$;

revoke all on function public.convertir_cotizacion_en_pedido(uuid, date) from public, anon;
grant execute on function public.convertir_cotizacion_en_pedido(uuid, date) to authenticated;

revoke all on public.cotizaciones_listado_view from anon;
grant select on public.cotizaciones_listado_view to authenticated;
