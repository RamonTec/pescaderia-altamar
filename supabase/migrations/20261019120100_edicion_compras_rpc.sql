-- 19-edicion-compras (2/3): RPC.
--
-- - registrar_compra: misma firma y cuerpo que 20261007180300, más
--   `compra_items.costo_kg_pactado` (si el item no lo trae, se deriva como el
--   relleno de 1/3).
-- - compra_recalcular_procesamiento / lote_reescribir_costo: funciones
--   internas (sin grant) de la propagación del costo.
-- - editar_compra: edición atómica de una compra (solo admin, motivo
--   obligatorio, historial). Lock de la compra y después de todos los lotes
--   del árbol (lotes de la compra + procesados hijos) en una sola sentencia
--   ordenada por `fecha_ingreso, codigo` (mismo orden que `registrar_factura`
--   y `corregir_linea_factura`: sin interbloqueos con ventas, procesamientos,
--   pérdidas y correcciones de facturas).
-- - detalle_compra: lectura (solo admin) para la ficha `/compras/[id]` y la
--   vista previa del diálogo, en una consulta.
--
-- Errores de editar_compra (`errcode P0001`, `hint`): compra_anulada,
-- sin_cambios, motivo_requerido, items_no_coinciden, peso_menor_consumido
-- (`detail = 'item:N'`, N desde 0 = índice en `p_items`), proveedor_invalido,
-- proveedor_bloqueado, fecha_invalida, fecha_posterior_a_salidas. Entradas
-- fuera de rango: `23514`. No existe: `P0002`. Sin permiso: `42501`.

-- ============ registrar_compra ============
-- p_compra: { id, proveedor_id, fecha, condicion, moneda, tasa_snapshot,
--             subtotal_usd, pagado_usd, estado, notas,
--             tasa_origen?, tasa_fuente?, tasa_referencial? }
-- p_items: [{ producto_id, peso_kg, costo_usd_kg, costo_kg_pactado? }]
-- Devuelve { compra_id, lotes: [{ lote_id, codigo, producto_id, peso_kg }] }.
create or replace function public.registrar_compra(
  p_compra jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := (p_compra ->> 'id')::uuid;
  v_fecha date := coalesce((p_compra ->> 'fecha')::date, current_date);
  v_proveedor uuid := (p_compra ->> 'proveedor_id')::uuid;
  v_moneda text := p_compra ->> 'moneda';
  v_tasa numeric := (p_compra ->> 'tasa_snapshot')::numeric;
  v_item record;
  v_producto public.productos%rowtype;
  v_item_id uuid;
  v_lote_id uuid;
  v_codigo text;
  v_peso numeric;
  v_costo numeric;
  v_pactado numeric;
  v_lotes jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La compra debe tener al menos un item' using errcode = '23514';
  end if;

  insert into public.compras (
    id, proveedor_id, fecha, condicion, moneda, tasa_snapshot,
    subtotal_usd, pagado_usd, estado, notas,
    tasa_origen, tasa_fuente, tasa_referencial
  ) values (
    v_id,
    v_proveedor,
    v_fecha,
    p_compra ->> 'condicion',
    v_moneda,
    v_tasa,
    (p_compra ->> 'subtotal_usd')::numeric,
    (p_compra ->> 'pagado_usd')::numeric,
    p_compra ->> 'estado',
    nullif(p_compra ->> 'notas', ''),
    coalesce(p_compra ->> 'tasa_origen', 'referencial'),
    nullif(p_compra ->> 'tasa_fuente', ''),
    case
      when coalesce(p_compra ->> 'tasa_origen', 'referencial') = 'referencial'
        then v_tasa
      else nullif(p_compra ->> 'tasa_referencial', '')::numeric
    end
  );

  for v_item in
    select
      (e.value ->> 'producto_id')::uuid as producto_id,
      (e.value ->> 'peso_kg')::numeric as peso_kg,
      (e.value ->> 'costo_usd_kg')::numeric as costo_usd_kg,
      nullif(e.value ->> 'costo_kg_pactado', '')::numeric as costo_kg_pactado
    from jsonb_array_elements(p_items) with ordinality as e(value, n)
    order by e.n
  loop
    select * into v_producto from public.productos where id = v_item.producto_id;
    if v_producto.id is null then
      raise exception 'El producto no existe' using errcode = 'P0002';
    end if;

    v_peso := round(v_item.peso_kg, 3);
    v_costo := round(v_item.costo_usd_kg, 6);
    -- 19: costo pactado en la moneda de la compra (el valor tecleado). Si no
    -- llega, se deriva como el relleno de 20261019120000.
    v_pactado := coalesce(
      round(v_item.costo_kg_pactado, 6),
      case when v_moneda = 'usd' then v_costo else round(v_costo * v_tasa, 2) end
    );

    insert into public.compra_items (compra_id, producto_id, peso_kg, costo_usd_kg, costo_kg_pactado)
    values (v_id, v_producto.id, v_peso, v_costo, v_pactado)
    returning id into v_item_id;

    if v_producto.controla_stock then
      v_codigo := public.generar_codigo_lote(v_producto.id, v_fecha);

      insert into public.lotes (
        codigo, producto_id, origen, compra_item_id, proveedor_id, fecha_ingreso,
        peso_inicial_kg, costo_usd_kg, moneda, tasa_snapshot
      ) values (
        v_codigo, v_producto.id, 'compra', v_item_id, v_proveedor, v_fecha,
        v_peso, v_costo, v_moneda, v_tasa
      )
      returning id into v_lote_id;

      v_lotes := v_lotes || jsonb_build_object(
        'lote_id', v_lote_id,
        'codigo', v_codigo,
        'producto_id', v_producto.id,
        'peso_kg', v_peso
      );
    else
      v_lote_id := null;
    end if;

    insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
    values (v_producto.id, v_lote_id, 'compra', v_peso, v_costo, v_id);
  end loop;

  return jsonb_build_object('compra_id', v_id, 'lotes', v_lotes);
end;
$$;

revoke all on function public.registrar_compra(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_compra(jsonb, jsonb) to authenticated;

-- ============ Funciones internas (no expuestas) ============

-- Recalcula el costo de un procesamiento ya registrado con el costo nuevo de
-- su lote crudo (16, mismo cálculo entero que `registrar_procesamiento`):
--   costo_total = round(peso_entrada × costo_lote, 6) y reparto con el
--   `reparto_costo` guardado y los `precio_referencia_usd_kg` snapshot de
--   sus salidas (orden `proceso_items.id`; el residuo va a la de mayor peso
--   de reparto y, en empate, a la de menor id). Sin `reparto_costo` (legado)
--   → por peso. Actualiza cabecera, salidas, lotes hijos y el `proceso_in`
--   sin lote de las salidas sin control de stock. Los kg no cambian.
-- Legado sin cabecera (líneas de lotes distintos, 16): cada salida de
-- `p_lote_id` se recalcula sola (una salida = 100 % de su entrada).
-- Espejo TS: `costingService.recalcularRepartoProceso`.
create or replace function public.compra_recalcular_procesamiento(
  p_procesamiento_id uuid,
  p_costo_lote numeric,
  p_lote_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pr public.procesamientos%rowtype;
  v_item record;
  v_ids uuid[];
  v_destinos uuid[];
  v_kgs_mil numeric[];
  v_precios_micro numeric[];
  v_pesos numeric[] := '{}';
  v_n int;
  v_suma_valor numeric := 0;
  v_costo_total numeric;
  v_costos_micro numeric[];
  v_costo numeric;
  v_costo_kg numeric;
  i int;
begin
  select * into v_pr from public.procesamientos where id = p_procesamiento_id for update;
  if v_pr.id is null then
    return;
  end if;

  -- ----- Legado sin cabecera: salida por salida del lote dado -----
  if v_pr.lote_origen_id is null or v_pr.peso_entrada_kg is null then
    for v_item in
      select pi.id, pi.peso_entrada_kg, pi.peso_salida_kg, pi.producto_destino_id
      from public.proceso_items pi
      where pi.procesamiento_id = v_pr.id
        and (p_lote_id is null or pi.lote_origen_id = p_lote_id)
      order by pi.id
    loop
      v_costo := round(v_item.peso_entrada_kg * p_costo_lote, 6);
      v_costo_kg := round(v_costo / v_item.peso_salida_kg, 6);
      update public.proceso_items set costo_total_usd = v_costo where id = v_item.id;
      update public.lotes set costo_usd_kg = v_costo_kg where proceso_item_id = v_item.id;
      update public.movimientos
      set costo_usd_kg = v_costo_kg
      where tipo = 'proceso_in' and ref_id = v_pr.id and lote_id is null
        and producto_id = v_item.producto_destino_id;
    end loop;

    update public.procesamientos
    set costo_total_usd = (
      select sum(pi.costo_total_usd) from public.proceso_items pi where pi.procesamiento_id = v_pr.id
    )
    where id = v_pr.id and costo_total_usd is not null;
    return;
  end if;

  -- ----- Con cabecera (16) -----
  select
    array_agg(pi.id order by pi.id),
    array_agg(pi.producto_destino_id order by pi.id),
    array_agg(round(pi.peso_salida_kg * 1000) order by pi.id),
    array_agg(round(coalesce(pi.precio_referencia_usd_kg, 0) * 1000000) order by pi.id)
  into v_ids, v_destinos, v_kgs_mil, v_precios_micro
  from public.proceso_items pi
  where pi.procesamiento_id = v_pr.id;

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then
    return;
  end if;

  for i in 1..v_n loop
    v_suma_valor := v_suma_valor + v_kgs_mil[i] * v_precios_micro[i];
  end loop;

  if coalesce(v_pr.reparto_costo, 'peso') = 'valor' and v_n >= 2 and v_suma_valor > 0 then
    for i in 1..v_n loop
      v_pesos[i] := v_kgs_mil[i] * v_precios_micro[i];
    end loop;
  else
    v_pesos := v_kgs_mil;
  end if;

  v_costo_total := round(v_pr.peso_entrada_kg * p_costo_lote, 6);
  v_costos_micro := public.procesamiento_repartir_costo(round(v_costo_total * 1000000), v_pesos);

  for i in 1..v_n loop
    v_costo := v_costos_micro[i] / 1000000;
    v_costo_kg := public.procesamiento_div_redondeo(v_costos_micro[i] * 1000, v_kgs_mil[i]) / 1000000;
    update public.proceso_items set costo_total_usd = v_costo where id = v_ids[i];
    update public.lotes set costo_usd_kg = v_costo_kg where proceso_item_id = v_ids[i];
    -- Salida sin control de stock: su `proceso_in` no tiene lote.
    update public.movimientos
    set costo_usd_kg = v_costo_kg
    where tipo = 'proceso_in' and ref_id = v_pr.id and lote_id is null
      and producto_id = v_destinos[i];
  end loop;

  update public.procesamientos set costo_total_usd = v_costo_total where id = v_pr.id;
end;
$$;

revoke all on function public.compra_recalcular_procesamiento(uuid, numeric, uuid) from public, anon, authenticated;

-- Lleva al costo del lote todas sus filas de `movimientos` (solo el costo,
-- nunca los kg) y de `factura_item_lotes`. Devuelve los `factura_item_id`
-- cuyas asignaciones cambiaron (el llamador recalcula su promedio).
create or replace function public.lote_reescribir_costo(p_lote_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_costo numeric;
  v_ids uuid[];
begin
  select l.costo_usd_kg into v_costo from public.lotes l where l.id = p_lote_id;
  if v_costo is null then
    return '{}'::uuid[];
  end if;

  update public.movimientos
  set costo_usd_kg = v_costo
  where lote_id = p_lote_id and costo_usd_kg is distinct from v_costo;

  with u as (
    update public.factura_item_lotes
    set costo_usd_kg = v_costo
    where lote_id = p_lote_id and costo_usd_kg is distinct from v_costo
    returning factura_item_id
  )
  select coalesce(array_agg(distinct u.factura_item_id), '{}'::uuid[]) into v_ids from u;

  return v_ids;
end;
$$;

revoke all on function public.lote_reescribir_costo(uuid) from public, anon, authenticated;

-- ============ editar_compra ============
-- p_cabecera: { proveedor_id, fecha, condicion, moneda, notas,
--               tasa: null | { tasa_snapshot, tasa_origen, tasa_fuente, tasa_referencial } }
--   (`tasa = null` conserva las cinco columnas de tasa; una clave ausente
--   conserva el valor vigente).
-- p_items: [{ compra_item_id, peso_kg, costo_kg_pactado }] — todas las
--   líneas de la compra, ni más ni menos.
-- Devuelve (sin costos de lotes):
-- { correccion_id, subtotal_usd, pagado_usd, saldo_usd, saldo_a_favor_usd,
--   estado, contrato: { id, numero, estado } | null,
--   lotes: [{ lote_id, codigo, delta_kg }],
--   propagacion: { lotes_recalculados, procesamientos, lineas_factura, facturas } }
create or replace function public.editar_compra(
  p_compra_id uuid,
  p_cabecera jsonb,
  p_items jsonb,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_correccion_id uuid := gen_random_uuid();
  v_compra public.compras%rowtype;
  v_cab jsonb := coalesce(p_cabecera, '{}'::jsonb);
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  -- Cabecera final
  v_proveedor_id uuid;
  v_proveedor public.proveedores%rowtype;
  v_fecha date;
  v_condicion text;
  v_moneda text;
  v_notas text;
  v_tasa jsonb;
  v_tasa_snapshot numeric;
  v_tasa_origen text;
  v_tasa_fuente text;
  v_tasa_referencial numeric;
  v_tasa_cambia boolean := false;
  v_cabecera_cambia boolean;
  v_lineas_cambian boolean := false;
  -- Líneas
  v_n_payload int;
  v_n_distintos int;
  v_n_invalidos int;
  v_n_items int;
  v_linea record;
  v_costo_nuevo numeric;
  v_delta numeric;
  v_stock numeric;
  -- Árbol de lotes
  v_lotes_compra uuid[];
  v_arbol uuid[];
  v_costos_antes jsonb;
  v_primera_salida date;
  v_lote record;
  v_pr record;
  v_costo_antes numeric;
  v_fi_ids uuid[] := '{}';
  v_tocados uuid[];
  v_n_procesamientos int := 0;
  v_lotes_prop jsonb := '[]'::jsonb;
  v_movs jsonb := '[]'::jsonb;
  v_mov_id uuid;
  v_n_lineas int := 0;
  v_n_facturas int := 0;
  -- Totales
  v_pagos numeric;
  v_subtotal numeric;
  v_pagado numeric;
  v_estado text;
  v_contrato public.contratos%rowtype;
  v_saldo numeric;
begin
  -- 1. Solo admin.
  if not public.es_admin() then
    raise exception 'Solo un administrador puede editar compras'
      using errcode = '42501';
  end if;

  -- 2. Lock de la compra (serializa con abonos y otras ediciones).
  select * into v_compra from public.compras where id = p_compra_id for update;
  if v_compra.id is null then
    raise exception 'La compra no existe' using errcode = 'P0002';
  end if;
  if v_compra.estado = 'anulada' then
    raise exception 'La compra está anulada: no se puede editar'
      using errcode = 'P0001', hint = 'compra_anulada';
  end if;

  -- 3. Motivo y líneas.
  if char_length(v_motivo) < 5 then
    raise exception 'Indica el motivo de la edición (mínimo 5 caracteres)'
      using errcode = 'P0001', hint = 'motivo_requerido';
  end if;
  if char_length(v_motivo) > 500 then
    raise exception 'El motivo admite hasta 500 caracteres'
      using errcode = 'P0001', hint = 'motivo_requerido';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Las líneas no coinciden con las de la compra'
      using errcode = 'P0001', hint = 'items_no_coinciden';
  end if;

  select
    count(*),
    count(distinct lower(e.value ->> 'compra_item_id')),
    count(*) filter (where coalesce(e.value ->> 'compra_item_id', '') !~ c_uuid)
  into v_n_payload, v_n_distintos, v_n_invalidos
  from jsonb_array_elements(p_items) e;

  select count(*) into v_n_items from public.compra_items where compra_id = v_compra.id;

  if v_n_invalidos > 0
     or v_n_payload <> v_n_items
     or v_n_distintos <> v_n_payload
     or exists (
       select 1
       from jsonb_array_elements(p_items) e
       where not exists (
         select 1 from public.compra_items ci
         where ci.compra_id = v_compra.id and ci.id::text = lower(e.value ->> 'compra_item_id')
       )
     ) then
    raise exception 'Las líneas no coinciden con las de la compra: no se pueden agregar, quitar ni repetir líneas'
      using errcode = 'P0001', hint = 'items_no_coinciden';
  end if;

  for v_linea in
    select (e.n - 1)::int as idx,
           round((e.value ->> 'peso_kg')::numeric, 3) as peso,
           round((e.value ->> 'costo_kg_pactado')::numeric, 6) as pactado
    from jsonb_array_elements(p_items) with ordinality as e(value, n)
  loop
    if v_linea.peso is null or v_linea.peso <= 0 then
      raise exception 'El peso debe ser mayor a 0'
        using errcode = '23514', detail = 'item:' || v_linea.idx;
    end if;
    if v_linea.pactado is null or v_linea.pactado < 0 then
      raise exception 'El costo no puede ser negativo'
        using errcode = '23514', detail = 'item:' || v_linea.idx;
    end if;
  end loop;

  -- Cabecera final (una clave ausente conserva el valor vigente).
  v_proveedor_id := coalesce(nullif(v_cab ->> 'proveedor_id', '')::uuid, v_compra.proveedor_id);
  v_fecha := coalesce(nullif(v_cab ->> 'fecha', '')::date, v_compra.fecha);
  v_condicion := coalesce(nullif(v_cab ->> 'condicion', ''), v_compra.condicion);
  v_moneda := coalesce(nullif(v_cab ->> 'moneda', ''), v_compra.moneda);
  v_notas := case
    when v_cab ? 'notas' then nullif(btrim(coalesce(v_cab ->> 'notas', '')), '')
    else v_compra.notas
  end;

  if v_condicion not in ('contado', 'credito') then
    raise exception 'Condición inválida' using errcode = '23514';
  end if;
  if v_moneda not in ('usd', 'bs') then
    raise exception 'Moneda inválida' using errcode = '23514';
  end if;

  -- Tasa: `null` conserva las cinco columnas.
  v_tasa := v_cab -> 'tasa';
  v_tasa_snapshot := v_compra.tasa_snapshot;
  v_tasa_origen := v_compra.tasa_origen;
  v_tasa_fuente := v_compra.tasa_fuente;
  v_tasa_referencial := v_compra.tasa_referencial;
  if v_tasa is not null and jsonb_typeof(v_tasa) = 'object' then
    v_tasa_snapshot := round((v_tasa ->> 'tasa_snapshot')::numeric, 6);
    v_tasa_origen := coalesce(nullif(v_tasa ->> 'tasa_origen', ''), 'referencial');
    v_tasa_fuente := nullif(v_tasa ->> 'tasa_fuente', '');
    if v_tasa_snapshot is null or v_tasa_snapshot <= 0 then
      raise exception 'La tasa debe ser mayor a 0' using errcode = '23514';
    end if;
    if v_tasa_origen not in ('referencial', 'manual') then
      raise exception 'Origen de tasa inválido' using errcode = '23514';
    end if;
    if v_tasa_fuente is not null and v_tasa_fuente not in ('bcv', 'paralela') then
      raise exception 'Fuente de tasa inválida' using errcode = '23514';
    end if;
    -- Igual que registrar_compra: con referencial no se confía en el cliente.
    v_tasa_referencial := case
      when v_tasa_origen = 'referencial' then v_tasa_snapshot
      else round(nullif(v_tasa ->> 'tasa_referencial', '')::numeric, 6)
    end;
    v_tasa_cambia := v_tasa_snapshot is distinct from v_compra.tasa_snapshot
      or v_tasa_origen is distinct from v_compra.tasa_origen
      or v_tasa_fuente is distinct from v_compra.tasa_fuente
      or v_tasa_referencial is distinct from v_compra.tasa_referencial;
    if not v_tasa_cambia then
      -- Misma tasa: se conservan tal cual (incluido quién la registró).
      v_tasa_snapshot := v_compra.tasa_snapshot;
      v_tasa_origen := v_compra.tasa_origen;
      v_tasa_fuente := v_compra.tasa_fuente;
      v_tasa_referencial := v_compra.tasa_referencial;
    end if;
  end if;

  -- 4. Proveedor.
  select * into v_proveedor from public.proveedores where id = v_proveedor_id;
  if v_proveedor_id is distinct from v_compra.proveedor_id then
    if v_proveedor.id is null or not v_proveedor.activo then
      raise exception 'El proveedor no existe o está inactivo'
        using errcode = 'P0001', hint = 'proveedor_invalido';
    end if;
  end if;
  if v_condicion = 'credito' and coalesce(v_proveedor.bloqueado, false)
     and (v_proveedor_id is distinct from v_compra.proveedor_id or v_compra.condicion <> 'credito') then
    raise exception '% está bloqueado: no se permiten compras a crédito', v_proveedor.nombre
      using errcode = 'P0001', hint = 'proveedor_bloqueado';
  end if;

  -- 5. Lock del árbol de lotes en una sola sentencia, orden PEPS.
  perform 1
  from public.lotes l
  where l.compra_item_id in (select ci.id from public.compra_items ci where ci.compra_id = v_compra.id)
     or l.lote_padre_id in (
       select lc.id
       from public.lotes lc
       join public.compra_items ci on ci.id = lc.compra_item_id
       where ci.compra_id = v_compra.id
     )
  order by l.fecha_ingreso, l.codigo
  for update;

  select coalesce(array_agg(l.id), '{}'::uuid[]) into v_lotes_compra
  from public.lotes l
  join public.compra_items ci on ci.id = l.compra_item_id
  where ci.compra_id = v_compra.id;

  -- Hijos nacidos mientras se esperaba el lock del padre (un procesamiento
  -- que terminó antes): con el padre bloqueado ya no pueden aparecer más.
  perform 1
  from public.lotes l
  where l.lote_padre_id = any(v_lotes_compra)
  order by l.fecha_ingreso, l.codigo
  for update;

  select coalesce(array_agg(l.id), '{}'::uuid[]) into v_arbol
  from public.lotes l
  where l.id = any(v_lotes_compra) or l.lote_padre_id = any(v_lotes_compra);

  select coalesce(jsonb_object_agg(l.id::text, l.costo_usd_kg), '{}'::jsonb) into v_costos_antes
  from public.lotes l
  where l.id = any(v_arbol);

  -- 6. Fecha: no futura; si cambia, no posterior a la primera salida.
  if v_fecha is distinct from v_compra.fecha then
    if v_fecha > v_hoy then
      raise exception 'La fecha no puede ser futura'
        using errcode = 'P0001', hint = 'fecha_invalida';
    end if;

    select min(x.fecha) into v_primera_salida
    from (
      select pr.fecha
      from public.procesamientos pr
      where pr.lote_origen_id = any(v_lotes_compra)
      union all
      select pr.fecha
      from public.proceso_items pi
      join public.procesamientos pr on pr.id = pi.procesamiento_id
      where pi.lote_origen_id = any(v_lotes_compra)
      union all
      select f.fecha
      from public.factura_item_lotes fil
      join public.factura_items fi on fi.id = fil.factura_item_id
      join public.facturas f on f.id = fi.factura_id
      where fil.lote_id = any(v_lotes_compra)
      union all
      select pl.fecha
      from public.perdidas_lote pl
      where pl.lote_id = any(v_lotes_compra)
    ) x;

    if v_primera_salida is not null and v_fecha > v_primera_salida then
      raise exception 'La fecha no puede ser posterior a la primera salida de sus lotes (%)',
        to_char(v_primera_salida, 'DD/MM/YYYY')
        using errcode = 'P0001', hint = 'fecha_posterior_a_salidas';
    end if;
  end if;

  -- 7. ¿Cambia algo?
  v_cabecera_cambia := v_proveedor_id is distinct from v_compra.proveedor_id
    or v_fecha is distinct from v_compra.fecha
    or v_condicion is distinct from v_compra.condicion
    or v_moneda is distinct from v_compra.moneda
    or v_notas is distinct from v_compra.notas
    or v_tasa_cambia;

  select exists (
    select 1
    from jsonb_array_elements(p_items) e
    join public.compra_items ci on ci.id::text = lower(e.value ->> 'compra_item_id')
    where round((e.value ->> 'peso_kg')::numeric, 3) <> ci.peso_kg
       or round((e.value ->> 'costo_kg_pactado')::numeric, 6) <> ci.costo_kg_pactado
  ) into v_lineas_cambian;

  if not v_cabecera_cambia and not v_lineas_cambian then
    raise exception 'No hay cambios que guardar'
      using errcode = 'P0001', hint = 'sin_cambios';
  end if;

  -- 8. Kg: bajar solo hasta lo consumido del lote.
  for v_linea in
    select (e.n - 1)::int as idx,
           round((e.value ->> 'peso_kg')::numeric, 3) as peso,
           ci.peso_kg as peso_anterior,
           l.id as lote_id,
           l.codigo
    from jsonb_array_elements(p_items) with ordinality as e(value, n)
    join public.compra_items ci on ci.id::text = lower(e.value ->> 'compra_item_id')
    left join public.lotes l on l.compra_item_id = ci.id
    order by e.n
  loop
    v_delta := v_linea.peso - v_linea.peso_anterior;
    if v_linea.lote_id is not null and v_delta < 0 then
      v_stock := public.lote_stock(v_linea.lote_id);
      if -v_delta > v_stock then
        raise exception 'El peso no puede bajar de % kg: es lo que ya se consumió del lote %',
          to_char(v_linea.peso_anterior - v_stock, 'FM999999990.000'),
          v_linea.codigo
          using errcode = 'P0001', hint = 'peso_menor_consumido', detail = 'item:' || v_linea.idx;
      end if;
    end if;
  end loop;

  -- 9. Orden de recálculo.
  -- 9.1–9.2 Líneas y lote de cada línea (+ historial de la línea).
  insert into public.compra_correcciones (
    id, compra_id,
    proveedor_anterior_id, proveedor_nuevo_id,
    fecha_anterior, fecha_nueva,
    condicion_anterior, condicion_nueva,
    moneda_anterior, moneda_nueva,
    tasa_anterior, tasa_nueva,
    tasa_origen_anterior, tasa_origen_nueva,
    tasa_fuente_anterior, tasa_fuente_nueva,
    tasa_referencial_anterior, tasa_referencial_nueva,
    notas_anterior, notas_nueva,
    subtotal_anterior_usd, subtotal_nuevo_usd,
    pagado_anterior_usd, pagado_nuevo_usd,
    pagos_registrados_usd,
    estado_anterior, estado_nuevo,
    motivo
  ) values (
    v_correccion_id, v_compra.id,
    v_compra.proveedor_id, v_proveedor_id,
    v_compra.fecha, v_fecha,
    v_compra.condicion, v_condicion,
    v_compra.moneda, v_moneda,
    v_compra.tasa_snapshot, v_tasa_snapshot,
    v_compra.tasa_origen, v_tasa_origen,
    v_compra.tasa_fuente, v_tasa_fuente,
    v_compra.tasa_referencial, v_tasa_referencial,
    v_compra.notas, v_notas,
    -- Totales y estado: provisionales, se completan en el paso 10.
    v_compra.subtotal_usd, v_compra.subtotal_usd,
    v_compra.pagado_usd, v_compra.pagado_usd,
    0,
    v_compra.estado, v_compra.estado,
    v_motivo
  );

  for v_linea in
    select (e.n - 1)::int as idx,
           ci.id,
           ci.producto_id,
           ci.peso_kg as peso_anterior,
           ci.costo_kg_pactado as pactado_anterior,
           ci.costo_usd_kg as costo_anterior,
           round((e.value ->> 'peso_kg')::numeric, 3) as peso,
           round((e.value ->> 'costo_kg_pactado')::numeric, 6) as pactado,
           l.id as lote_id,
           l.codigo as lote_codigo,
           l.estado as lote_estado
    from jsonb_array_elements(p_items) with ordinality as e(value, n)
    join public.compra_items ci on ci.id::text = lower(e.value ->> 'compra_item_id')
    left join public.lotes l on l.compra_item_id = ci.id
    order by e.n
  loop
    -- Costo USD con la moneda y la tasa finales. Si ni el pactado, ni la
    -- moneda ni la tasa cambian, se conserva el costo vigente.
    if v_linea.pactado = v_linea.pactado_anterior
       and v_moneda = v_compra.moneda
       and v_tasa_snapshot = v_compra.tasa_snapshot then
      v_costo_nuevo := v_linea.costo_anterior;
    else
      v_costo_nuevo := case
        when v_moneda = 'usd' then round(v_linea.pactado, 6)
        else round(v_linea.pactado / v_tasa_snapshot, 6)
      end;
    end if;
    v_delta := v_linea.peso - v_linea.peso_anterior;

    update public.compra_items
    set peso_kg = v_linea.peso,
        costo_kg_pactado = v_linea.pactado,
        costo_usd_kg = v_costo_nuevo
    where id = v_linea.id;

    if v_linea.lote_id is not null then
      -- El código no cambia (puede estar rotulado).
      update public.lotes
      set peso_inicial_kg = v_linea.peso,
          costo_usd_kg = v_costo_nuevo,
          moneda = v_moneda,
          tasa_snapshot = v_tasa_snapshot,
          proveedor_id = v_proveedor_id,
          fecha_ingreso = v_fecha
      where id = v_linea.lote_id;

      if v_delta <> 0 then
        insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
        values (v_linea.producto_id, v_linea.lote_id, 'correccion_compra', v_delta, v_costo_nuevo, v_correccion_id);

        -- D7: subir kg reabre un lote cerrado o agotado.
        if v_delta > 0 and v_linea.lote_estado in ('cerrado', 'agotado') then
          update public.lotes set estado = 'abierto' where id = v_linea.lote_id;
        end if;
        perform public.lote_sincronizar_estado(v_linea.lote_id);

        v_movs := v_movs || jsonb_build_object(
          'lote_id', v_linea.lote_id, 'codigo', v_linea.lote_codigo, 'delta_kg', v_delta
        );
      end if;
    else
      -- Sin control de stock: el movimiento `compra` sin lote de la línea
      -- (mismo producto; si hay varios, el de costo y peso más parecidos) y
      -- sus `correccion_compra` siguen al costo nuevo.
      if v_costo_nuevo <> v_linea.costo_anterior then
        select m.id into v_mov_id
        from public.movimientos m
        where m.tipo = 'compra' and m.ref_id = v_compra.id and m.lote_id is null
          and m.producto_id = v_linea.producto_id
        order by (m.costo_usd_kg = v_linea.costo_anterior) desc,
                 abs(m.peso_kg - v_linea.peso_anterior),
                 m.id
        limit 1;
        if v_mov_id is not null then
          update public.movimientos set costo_usd_kg = v_costo_nuevo where id = v_mov_id;
        end if;
        update public.movimientos m
        set costo_usd_kg = v_costo_nuevo
        where m.tipo = 'correccion_compra' and m.lote_id is null
          and m.producto_id = v_linea.producto_id
          and m.ref_id in (
            select cci.correccion_id from public.compra_correccion_items cci
            where cci.compra_item_id = v_linea.id
          );
      end if;
      if v_delta <> 0 then
        insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
        values (v_linea.producto_id, null, 'correccion_compra', v_delta, v_costo_nuevo, v_correccion_id);
      end if;
    end if;

    if v_delta <> 0 or v_linea.pactado <> v_linea.pactado_anterior or v_costo_nuevo <> v_linea.costo_anterior then
      insert into public.compra_correccion_items (
        correccion_id, compra_item_id, lote_id,
        peso_anterior_kg, peso_nuevo_kg,
        costo_pactado_anterior, costo_pactado_nuevo,
        costo_anterior_usd_kg, costo_nuevo_usd_kg
      ) values (
        v_correccion_id, v_linea.id, v_linea.lote_id,
        v_linea.peso_anterior, v_linea.peso,
        v_linea.pactado_anterior, v_linea.pactado,
        v_linea.costo_anterior, v_costo_nuevo
      );
    end if;
  end loop;

  -- 9.3 Hijos: heredan proveedor, moneda y tasa (no la fecha).
  update public.lotes
  set proveedor_id = v_proveedor_id,
      moneda = v_moneda,
      tasa_snapshot = v_tasa_snapshot
  where lote_padre_id = any(v_lotes_compra);

  -- 9.4 Procesamientos de cada lote de la compra cuyo costo cambió.
  for v_lote in
    select l.id, l.costo_usd_kg
    from public.lotes l
    where l.id = any(v_lotes_compra)
      and l.costo_usd_kg is distinct from (v_costos_antes ->> l.id::text)::numeric
    order by l.fecha_ingreso, l.codigo
  loop
    for v_pr in
      select pr.id
      from public.procesamientos pr
      where pr.lote_origen_id = v_lote.id
         or (pr.lote_origen_id is null and exists (
           select 1 from public.proceso_items pi
           where pi.procesamiento_id = pr.id and pi.lote_origen_id = v_lote.id
         ))
      order by pr.fecha, pr.id
    loop
      perform public.compra_recalcular_procesamiento(v_pr.id, v_lote.costo_usd_kg, v_lote.id);
      v_n_procesamientos := v_n_procesamientos + 1;
    end loop;
  end loop;

  -- 9.5–9.6 Ledger y asignaciones de venta de cada lote del árbol cuyo
  -- costo cambió (solo el costo; nunca los kg).
  for v_lote in
    select l.id, l.codigo, l.origen, l.costo_usd_kg
    from public.lotes l
    where l.id = any(v_arbol)
    order by l.fecha_ingreso, l.codigo
  loop
    v_costo_antes := (v_costos_antes ->> v_lote.id::text)::numeric;
    if v_lote.costo_usd_kg is distinct from v_costo_antes then
      v_tocados := public.lote_reescribir_costo(v_lote.id);
      v_fi_ids := v_fi_ids || v_tocados;
      v_lotes_prop := v_lotes_prop || jsonb_build_object(
        'lote_id', v_lote.id,
        'codigo', v_lote.codigo,
        'origen', v_lote.origen,
        'costo_anterior', v_costo_antes,
        'costo_nuevo', v_lote.costo_usd_kg
      );
    end if;
  end loop;

  -- Promedio ponderado de cada línea vendida afectada (regla de 07 y 17).
  -- Incluye facturas anuladas (invariante). Precios, totales, IVA, pagado y
  -- estado de las facturas no se tocan.
  if coalesce(array_length(v_fi_ids, 1), 0) > 0 then
    update public.factura_items fi
    set costo_usd_kg = coalesce((
      select round(sum(fil.peso_kg * fil.costo_usd_kg) / fi.peso_kg, 6)
      from public.factura_item_lotes fil
      where fil.factura_item_id = fi.id
    ), 0)
    where fi.id = any(v_fi_ids);

    select count(distinct fi.id), count(distinct fi.factura_id)
    into v_n_lineas, v_n_facturas
    from public.factura_items fi
    where fi.id = any(v_fi_ids);
  end if;

  -- 9.8 Compra: cabecera, total, pagado y estado (D1–D3).
  select round(coalesce(sum(ci.peso_kg * ci.costo_usd_kg), 0), 6) into v_subtotal
  from public.compra_items ci
  where ci.compra_id = v_compra.id;

  select coalesce(sum(pp.monto_usd), 0) into v_pagos
  from public.pagos_proveedores pp
  where pp.compra_id = v_compra.id;

  -- Crédito: solo lo registrado. Contado: el pago implícito al registrar
  -- cubre lo que no cubren los pagos registrados.
  v_pagado := case when v_condicion = 'credito' then v_pagos else greatest(v_pagos, v_subtotal) end;
  v_estado := case when v_subtotal - v_pagado <= 0.000001 then 'pagada' else 'abierta' end;

  update public.compras
  set proveedor_id = v_proveedor_id,
      fecha = v_fecha,
      condicion = v_condicion,
      moneda = v_moneda,
      notas = v_notas,
      tasa_snapshot = v_tasa_snapshot,
      tasa_origen = v_tasa_origen,
      tasa_fuente = v_tasa_fuente,
      tasa_referencial = v_tasa_referencial,
      tasa_registrada_por = case when v_tasa_cambia then auth.uid() else tasa_registrada_por end,
      subtotal_usd = v_subtotal,
      pagado_usd = v_pagado,
      estado = v_estado
  where id = v_compra.id;

  -- 10. Historial: totales, contrato activo (queda desactualizado) y propagación.
  select * into v_contrato
  from public.contratos ct
  where ct.compra_id = v_compra.id and ct.estado <> 'anulado'
  limit 1;

  update public.compra_correcciones
  set subtotal_nuevo_usd = v_subtotal,
      pagado_nuevo_usd = v_pagado,
      pagos_registrados_usd = v_pagos,
      estado_nuevo = v_estado,
      contrato_id = v_contrato.id,
      propagacion = jsonb_build_object(
        'lotes', v_lotes_prop,
        'procesamientos', v_n_procesamientos,
        'lineas_factura', v_n_lineas,
        'facturas', v_n_facturas
      )
  where id = v_correccion_id;

  v_saldo := round(v_subtotal - v_pagado, 6);

  return jsonb_build_object(
    'correccion_id', v_correccion_id,
    'subtotal_usd', v_subtotal,
    'pagado_usd', v_pagado,
    'saldo_usd', greatest(v_saldo, 0),
    'saldo_a_favor_usd', greatest(-v_saldo, 0),
    'estado', v_estado,
    'contrato', case
      when v_contrato.id is null then null
      else jsonb_build_object('id', v_contrato.id, 'numero', v_contrato.numero, 'estado', v_contrato.estado)
    end,
    'lotes', v_movs,
    'propagacion', jsonb_build_object(
      'lotes_recalculados', jsonb_array_length(v_lotes_prop),
      'procesamientos', v_n_procesamientos,
      'lineas_factura', v_n_lineas,
      'facturas', v_n_facturas
    )
  );
end;
$$;

revoke all on function public.editar_compra(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.editar_compra(uuid, jsonb, jsonb, text) to authenticated;

-- ============ detalle_compra ============
-- Solo admin (muestra costos). `null` si la compra no existe. Alimenta la
-- ficha `/compras/[id]` y la vista previa de `EditarCompraDialog` sin N+1.
create or replace function public.detalle_compra(p_compra_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede ver el detalle de una compra'
      using errcode = '42501';
  end if;

  with
  lotes_compra as (
    select l.*
    from public.lotes l
    join public.compra_items ci on ci.id = l.compra_item_id
    where ci.compra_id = p_compra_id
  ),
  arbol as (
    select l.* from public.lotes l where l.id in (select id from lotes_compra)
    union all
    select l.* from public.lotes l where l.lote_padre_id in (select id from lotes_compra)
  ),
  -- Kg vendidos por lote (facturas no anuladas), con líneas y facturas.
  ventas_lote as (
    select fil.lote_id,
           sum(fil.peso_kg) as kg,
           count(distinct fil.factura_item_id) as lineas,
           count(distinct fi.factura_id) as facturas
    from public.factura_item_lotes fil
    join public.factura_items fi on fi.id = fil.factura_item_id
    join public.facturas f on f.id = fi.factura_id
    where fil.lote_id in (select id from arbol) and f.estado <> 'anulada'
    group by fil.lote_id
  )
  select jsonb_build_object(
    'compra', jsonb_build_object(
      'id', c.id,
      'fecha', c.fecha,
      'condicion', c.condicion,
      'moneda', c.moneda,
      'tasa_snapshot', c.tasa_snapshot,
      'tasa_origen', c.tasa_origen,
      'tasa_fuente', c.tasa_fuente,
      'tasa_referencial', c.tasa_referencial,
      'subtotal_usd', c.subtotal_usd,
      'pagado_usd', c.pagado_usd,
      'estado', c.estado,
      'notas', c.notas,
      'created_at', c.created_at,
      'proveedor', jsonb_build_object(
        'id', pv.id,
        'nombre', pv.nombre,
        'rif_ci', pv.rif_ci,
        'activo', pv.activo,
        'bloqueado', pv.bloqueado,
        'motivo_bloqueo', pv.motivo_bloqueo
      )
    ),

    'pagos_registrados_usd', coalesce((
      select sum(pp.monto_usd) from public.pagos_proveedores pp where pp.compra_id = c.id
    ), 0),

    -- Primera salida de los lotes de la compra (tope de la fecha, D5).
    'primera_salida', (
      select min(x.fecha) from (
        select pr.fecha from public.procesamientos pr
        where pr.lote_origen_id in (select id from lotes_compra)
        union all
        select pr.fecha from public.proceso_items pi
        join public.procesamientos pr on pr.id = pi.procesamiento_id
        where pi.lote_origen_id in (select id from lotes_compra)
        union all
        select f.fecha from public.factura_item_lotes fil
        join public.factura_items fi on fi.id = fil.factura_item_id
        join public.facturas f on f.id = fi.factura_id
        where fil.lote_id in (select id from lotes_compra)
        union all
        select pl.fecha from public.perdidas_lote pl
        where pl.lote_id in (select id from lotes_compra)
      ) x
    ),

    -- Líneas y facturas (no anuladas) con kg de algún lote del árbol, sin
    -- contar dos veces una línea que toma de dos lotes.
    'ventas_arbol', (
      select jsonb_build_object(
        'lineas', count(distinct fil.factura_item_id),
        'facturas', count(distinct fi.factura_id)
      )
      from public.factura_item_lotes fil
      join public.factura_items fi on fi.id = fil.factura_item_id
      join public.facturas f on f.id = fi.factura_id
      where fil.lote_id in (select id from arbol) and f.estado <> 'anulada'
    ),

    'lineas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'producto', jsonb_build_object(
          'id', p.id,
          'nombre', p.nombre,
          'codigo', p.codigo,
          'controla_stock', p.controla_stock
        ),
        'peso_kg', ci.peso_kg,
        'costo_kg_pactado', ci.costo_kg_pactado,
        'costo_usd_kg', ci.costo_usd_kg,
        'lote', case when l.id is null then null else jsonb_build_object(
          'id', l.id,
          'codigo', l.codigo,
          'estado', l.estado,
          'fecha_ingreso', l.fecha_ingreso,
          'peso_inicial_kg', l.peso_inicial_kg,
          'costo_usd_kg', l.costo_usd_kg,
          'stock_kg', public.lote_stock(l.id),
          -- Desglose del consumo (Σ = peso_inicial − stock).
          'kg_procesados', coalesce((
            select -sum(m.peso_kg) from public.movimientos m
            where m.lote_id = l.id and m.tipo = 'proceso_out'
          ), 0),
          'kg_vendidos', coalesce((
            select -sum(m.peso_kg) from public.movimientos m
            where m.lote_id = l.id and m.tipo in ('venta', 'correccion_venta', 'ajuste')
          ), 0),
          'kg_perdidos', coalesce((
            select -sum(m.peso_kg) from public.movimientos m
            where m.lote_id = l.id and m.tipo = 'perdida'
          ), 0),
          'primera_salida', (
            select min(x.fecha) from (
              select pr.fecha from public.procesamientos pr where pr.lote_origen_id = l.id
              union all
              select pr.fecha from public.proceso_items pi
              join public.procesamientos pr on pr.id = pi.procesamiento_id
              where pi.lote_origen_id = l.id
              union all
              select f.fecha from public.factura_item_lotes fil
              join public.factura_items fi on fi.id = fil.factura_item_id
              join public.facturas f on f.id = fi.factura_id
              where fil.lote_id = l.id
              union all
              select pl.fecha from public.perdidas_lote pl where pl.lote_id = l.id
            ) x
          ),
          'ventas', jsonb_build_object(
            'kg', coalesce(vl.kg, 0),
            'lineas', coalesce(vl.lineas, 0),
            'facturas', coalesce(vl.facturas, 0)
          ),
          'procesamientos', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', pr.id,
              'fecha', pr.fecha,
              'legado', pr.lote_origen_id is null or pr.peso_entrada_kg is null,
              'peso_entrada_kg', coalesce(pr.peso_entrada_kg, (
                select sum(x.peso_entrada_kg) from public.proceso_items x
                where x.procesamiento_id = pr.id and x.lote_origen_id = l.id
              )),
              'costo_total_usd', pr.costo_total_usd,
              'reparto_costo', pr.reparto_costo,
              'salidas', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'proceso_item_id', pi.id,
                  'producto_id', pd.id,
                  'producto_nombre', pd.nombre,
                  'peso_entrada_kg', pi.peso_entrada_kg,
                  'peso_salida_kg', pi.peso_salida_kg,
                  'precio_referencia_usd_kg', pi.precio_referencia_usd_kg,
                  'costo_total_usd', pi.costo_total_usd,
                  'lote', case when lh.id is null then null else jsonb_build_object(
                    'id', lh.id,
                    'codigo', lh.codigo,
                    'estado', lh.estado,
                    'peso_inicial_kg', lh.peso_inicial_kg,
                    'stock_kg', public.lote_stock(lh.id),
                    'costo_usd_kg', lh.costo_usd_kg,
                    'ventas', jsonb_build_object(
                      'kg', coalesce(vh.kg, 0),
                      'lineas', coalesce(vh.lineas, 0),
                      'facturas', coalesce(vh.facturas, 0)
                    )
                  ) end
                ) order by pi.id)
                from public.proceso_items pi
                join public.productos pd on pd.id = pi.producto_destino_id
                left join public.lotes lh on lh.proceso_item_id = pi.id
                left join ventas_lote vh on vh.lote_id = lh.id
                where pi.procesamiento_id = pr.id
                  and (pr.lote_origen_id is not null or pi.lote_origen_id = l.id)
              ), '[]'::jsonb)
            ) order by pr.fecha, pr.id)
            from public.procesamientos pr
            where pr.lote_origen_id = l.id
               or (pr.lote_origen_id is null and exists (
                 select 1 from public.proceso_items x
                 where x.procesamiento_id = pr.id and x.lote_origen_id = l.id
               ))
          ), '[]'::jsonb)
        ) end
      ) order by p.nombre, ci.id)
      from public.compra_items ci
      join public.productos p on p.id = ci.producto_id
      left join public.lotes l on l.compra_item_id = ci.id
      left join ventas_lote vl on vl.lote_id = l.id
      where ci.compra_id = c.id
    ), '[]'::jsonb),

    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pp.id,
        'fecha', pp.fecha,
        'monto_usd', pp.monto_usd,
        'moneda_pago', pp.moneda_pago,
        'tasa_pago', pp.tasa_pago,
        'metodo', pp.metodo,
        'ganancia_cambiaria_bs', pp.ganancia_cambiaria_bs
      ) order by pp.fecha, pp.created_at)
      from public.pagos_proveedores pp
      where pp.compra_id = c.id
    ), '[]'::jsonb),

    'contrato', (
      select jsonb_build_object(
        'id', ct.id,
        'numero', ct.numero,
        'estado', ct.estado,
        'created_at', ct.created_at,
        'desactualizado', exists (
          select 1 from public.compra_correcciones c2
          where c2.compra_id = c.id and c2.created_at > ct.created_at
        )
      )
      from public.contratos ct
      where ct.compra_id = c.id and ct.estado <> 'anulado'
      limit 1
    ),

    'correcciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cc.id,
        'proveedor_anterior', jsonb_build_object('id', pa.id, 'nombre', pa.nombre),
        'proveedor_nuevo', jsonb_build_object('id', pn.id, 'nombre', pn.nombre),
        'fecha_anterior', cc.fecha_anterior,
        'fecha_nueva', cc.fecha_nueva,
        'condicion_anterior', cc.condicion_anterior,
        'condicion_nueva', cc.condicion_nueva,
        'moneda_anterior', cc.moneda_anterior,
        'moneda_nueva', cc.moneda_nueva,
        'tasa_anterior', cc.tasa_anterior,
        'tasa_nueva', cc.tasa_nueva,
        'tasa_origen_anterior', cc.tasa_origen_anterior,
        'tasa_origen_nueva', cc.tasa_origen_nueva,
        'tasa_fuente_anterior', cc.tasa_fuente_anterior,
        'tasa_fuente_nueva', cc.tasa_fuente_nueva,
        'tasa_referencial_anterior', cc.tasa_referencial_anterior,
        'tasa_referencial_nueva', cc.tasa_referencial_nueva,
        'notas_anterior', cc.notas_anterior,
        'notas_nueva', cc.notas_nueva,
        'subtotal_anterior_usd', cc.subtotal_anterior_usd,
        'subtotal_nuevo_usd', cc.subtotal_nuevo_usd,
        'pagado_anterior_usd', cc.pagado_anterior_usd,
        'pagado_nuevo_usd', cc.pagado_nuevo_usd,
        'pagos_registrados_usd', cc.pagos_registrados_usd,
        'estado_anterior', cc.estado_anterior,
        'estado_nuevo', cc.estado_nuevo,
        'contrato_id', cc.contrato_id,
        'contrato_numero', cct.numero,
        'propagacion', cc.propagacion,
        'motivo', cc.motivo,
        'usuario_id', cc.usuario_id,
        'usuario_nombre', pf.nombre,
        'created_at', cc.created_at,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'compra_item_id', cci.compra_item_id,
            'producto_nombre', ip.nombre,
            'lote_id', cci.lote_id,
            'lote_codigo', il.codigo,
            'peso_anterior_kg', cci.peso_anterior_kg,
            'peso_nuevo_kg', cci.peso_nuevo_kg,
            'costo_pactado_anterior', cci.costo_pactado_anterior,
            'costo_pactado_nuevo', cci.costo_pactado_nuevo,
            'costo_anterior_usd_kg', cci.costo_anterior_usd_kg,
            'costo_nuevo_usd_kg', cci.costo_nuevo_usd_kg
          ) order by ip.nombre, cci.compra_item_id)
          from public.compra_correccion_items cci
          join public.compra_items ici on ici.id = cci.compra_item_id
          join public.productos ip on ip.id = ici.producto_id
          left join public.lotes il on il.id = cci.lote_id
          where cci.correccion_id = cc.id
        ), '[]'::jsonb)
      ) order by cc.created_at desc)
      from public.compra_correcciones cc
      join public.proveedores pa on pa.id = cc.proveedor_anterior_id
      join public.proveedores pn on pn.id = cc.proveedor_nuevo_id
      left join public.perfiles pf on pf.id = cc.usuario_id
      left join public.contratos cct on cct.id = cc.contrato_id
      where cc.compra_id = c.id
    ), '[]'::jsonb)
  )
  into v_resultado
  from public.compras c
  join public.proveedores pv on pv.id = c.proveedor_id
  where c.id = p_compra_id;

  return v_resultado;
end;
$$;

revoke all on function public.detalle_compra(uuid) from public, anon;
grant execute on function public.detalle_compra(uuid) to authenticated;
