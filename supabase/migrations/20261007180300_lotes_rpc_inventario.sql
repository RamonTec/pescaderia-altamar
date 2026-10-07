-- 07-lotes (4/5): RPC de inventario por lote.
--
-- - registrar_compra: crea un lote por item y devuelve sus códigos (sin
--   costos) para rotular. Pasa a `security definer` (lotes y movimientos no
--   tienen política de insert) y ya no recibe `p_movimientos`: los arma la
--   función con el lote de cada item. Conserva la procedencia de la tasa
--   (08-tasas, 0019).
-- - registrar_procesamiento: exige `lote_origen_id`, bloquea la fila del lote
--   (`for update`, reemplaza el advisory lock por producto de 0013) y crea el
--   lote procesado ligado a su padre. Devuelve el código generado.
-- - registrar_perdida / cerrar_lote: pérdidas por lote (cualquier usuario).
-- - Se retira `stock_y_costo_producto` (promedio ponderado): ya no la usa nada.
--
-- Productos con `controla_stock = false`: no usan lotes (movimiento sin
-- lote, sin validación de stock); no se pueden procesar por lote.

-- ============ registrar_compra ============
-- p_compra: { id, proveedor_id, fecha, condicion, moneda, tasa_snapshot,
--             subtotal_usd, pagado_usd, estado, notas,
--             tasa_origen?, tasa_fuente?, tasa_referencial? }
-- p_items: [{ producto_id, peso_kg, costo_usd_kg }]
-- Devuelve { compra_id, lotes: [{ lote_id, codigo, producto_id, peso_kg }] }.
drop function if exists public.registrar_compra(jsonb, jsonb, jsonb);

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
      (e.value ->> 'costo_usd_kg')::numeric as costo_usd_kg
    from jsonb_array_elements(p_items) with ordinality as e(value, n)
    order by e.n
  loop
    select * into v_producto from public.productos where id = v_item.producto_id;
    if v_producto.id is null then
      raise exception 'El producto no existe' using errcode = 'P0002';
    end if;

    v_peso := round(v_item.peso_kg, 3);
    v_costo := round(v_item.costo_usd_kg, 6);

    insert into public.compra_items (compra_id, producto_id, peso_kg, costo_usd_kg)
    values (v_id, v_producto.id, v_peso, v_costo)
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

-- ============ registrar_procesamiento ============
-- p_procesamiento: { id, fecha, notas }
-- p_items: [{ lote_origen_id, producto_origen_id, peso_entrada_kg,
--             producto_destino_id, peso_salida_kg }]
-- Devuelve { procesamiento_id, lotes: [{ lote_id, codigo, producto_id, peso_kg }] }
-- (los lotes procesados generados, sin costos).
drop function if exists public.registrar_procesamiento(jsonb, jsonb);

create or replace function public.registrar_procesamiento(
  p_procesamiento jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := (p_procesamiento ->> 'id')::uuid;
  v_fecha date := coalesce((p_procesamiento ->> 'fecha')::date, current_date);
  v_item record;
  v_lote public.lotes%rowtype;
  v_origen public.productos%rowtype;
  v_destino public.productos%rowtype;
  v_stock numeric;
  v_entrada numeric;
  v_salida numeric;
  v_costo_total numeric;
  v_costo_destino numeric;
  v_proceso_item_id uuid;
  v_lote_destino_id uuid;
  v_codigo text;
  v_lotes jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'El procesamiento debe tener al menos una línea' using errcode = '23514';
  end if;

  insert into public.procesamientos (id, fecha, notas)
  values (v_id, v_fecha, nullif(p_procesamiento ->> 'notas', ''));

  for v_item in
    select
      nullif(e.value ->> 'lote_origen_id', '')::uuid as lote_origen_id,
      nullif(e.value ->> 'producto_origen_id', '')::uuid as producto_origen_id,
      (e.value ->> 'peso_entrada_kg')::numeric as peso_entrada_kg,
      (e.value ->> 'producto_destino_id')::uuid as producto_destino_id,
      (e.value ->> 'peso_salida_kg')::numeric as peso_salida_kg
    from jsonb_array_elements(p_items) with ordinality as e(value, n)
    order by e.n
  loop
    if v_item.lote_origen_id is null then
      raise exception 'Elige el lote de origen'
        using errcode = 'P0001', hint = 'lote_no_disponible';
    end if;

    -- Bloquea la fila del lote: dos operaciones sobre el mismo lote se
    -- serializan y nunca lo dejan en negativo.
    select * into v_lote from public.lotes where id = v_item.lote_origen_id for update;
    if v_lote.id is null then
      raise exception 'El lote no existe' using errcode = 'P0001', hint = 'lote_no_disponible';
    end if;

    select * into v_origen from public.productos where id = v_lote.producto_id;
    select * into v_destino from public.productos where id = v_item.producto_destino_id;

    if v_item.producto_origen_id is not null and v_item.producto_origen_id <> v_lote.producto_id then
      raise exception 'El lote % no es de %', v_lote.codigo, coalesce(v_origen.nombre, 'ese producto')
        using errcode = 'P0001', hint = 'lote_no_disponible';
    end if;
    if not v_origen.activo or v_origen.tipo <> 'crudo' then
      raise exception 'El producto origen debe ser un crudo activo'
        using errcode = 'P0001', hint = 'origen_invalido';
    end if;
    if v_destino.id is null or not v_destino.activo or v_destino.tipo <> 'procesado' then
      raise exception 'El producto destino debe ser un procesado activo'
        using errcode = 'P0001', hint = 'destino_invalido';
    end if;
    if v_destino.producto_origen_id is distinct from v_origen.id then
      raise exception '% no se obtiene de %', v_destino.nombre, v_origen.nombre
        using errcode = 'P0001', hint = 'destino_no_corresponde';
    end if;
    if v_lote.estado <> 'abierto' then
      raise exception 'El lote % no está abierto', v_lote.codigo
        using errcode = 'P0001', hint = 'lote_no_disponible';
    end if;

    v_entrada := round(v_item.peso_entrada_kg, 3);
    v_salida := round(v_item.peso_salida_kg, 3);
    if v_entrada <= 0 or v_salida <= 0 then
      raise exception 'Los pesos deben ser mayores a 0' using errcode = '23514';
    end if;

    v_stock := public.lote_stock(v_lote.id);
    if v_entrada > v_stock then
      raise exception 'Stock insuficiente en el lote %: hay % kg y se quieren procesar % kg',
        v_lote.codigo, round(v_stock, 3), v_entrada
        using errcode = 'P0001', hint = 'stock_insuficiente';
    end if;

    -- Transferencia total del costo (§4.3): la merma encarece el kg neto.
    v_costo_total := round(v_entrada * v_lote.costo_usd_kg, 6);
    v_costo_destino := round(v_costo_total / v_salida, 6);

    -- `salida_menor_entrada` (0001) rechaza salida > entrada.
    insert into public.proceso_items (
      procesamiento_id, producto_origen_id, peso_entrada_kg,
      producto_destino_id, peso_salida_kg, costo_total_usd, lote_origen_id
    ) values (
      v_id, v_origen.id, v_entrada,
      v_destino.id, v_salida, v_costo_total, v_lote.id
    )
    returning id into v_proceso_item_id;

    insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
    values (v_origen.id, v_lote.id, 'proceso_out', -v_entrada, v_lote.costo_usd_kg, v_id);

    if v_destino.controla_stock then
      v_codigo := public.generar_codigo_lote(v_destino.id, v_fecha);

      -- Un lote crudo da un lote procesado: hereda proveedor, moneda y tasa.
      insert into public.lotes (
        codigo, producto_id, origen, proceso_item_id, lote_padre_id, proveedor_id,
        fecha_ingreso, peso_inicial_kg, costo_usd_kg, moneda, tasa_snapshot
      ) values (
        v_codigo, v_destino.id, 'proceso', v_proceso_item_id, v_lote.id, v_lote.proveedor_id,
        v_fecha, v_salida, v_costo_destino, v_lote.moneda, v_lote.tasa_snapshot
      )
      returning id into v_lote_destino_id;

      v_lotes := v_lotes || jsonb_build_object(
        'lote_id', v_lote_destino_id,
        'codigo', v_codigo,
        'producto_id', v_destino.id,
        'peso_kg', v_salida
      );
    else
      v_lote_destino_id := null;
    end if;

    insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
    values (v_destino.id, v_lote_destino_id, 'proceso_in', v_salida, v_costo_destino, v_id);

    perform public.lote_sincronizar_estado(v_lote.id);
  end loop;

  return jsonb_build_object('procesamiento_id', v_id, 'lotes', v_lotes);
end;
$$;

revoke all on function public.registrar_procesamiento(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_procesamiento(jsonb, jsonb) to authenticated;

-- ============ registrar_perdida ============
-- Cualquier usuario autenticado. Motivos: danado, vencido, faltante, otro
-- (`cierre` lo usa solo `cerrar_lote`). Movimiento `perdida` al costo del lote.
create or replace function public.registrar_perdida(
  p_lote_id uuid,
  p_peso_kg numeric,
  p_motivo text,
  p_detalle text default null,
  p_fecha date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.lotes%rowtype;
  v_peso numeric := round(p_peso_kg, 3);
  v_stock numeric;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  if p_motivo is null or p_motivo not in ('danado', 'vencido', 'faltante', 'otro') then
    raise exception 'Motivo de pérdida inválido' using errcode = '23514', hint = 'motivo_invalido';
  end if;
  if v_peso is null or v_peso <= 0 then
    raise exception 'El peso debe ser mayor a 0' using errcode = '23514';
  end if;

  select * into v_lote from public.lotes where id = p_lote_id for update;
  if v_lote.id is null then
    raise exception 'El lote no existe' using errcode = 'P0001', hint = 'lote_no_disponible';
  end if;
  if v_lote.estado <> 'abierto' then
    raise exception 'El lote % no está abierto', v_lote.codigo
      using errcode = 'P0001', hint = 'lote_no_disponible';
  end if;

  v_stock := public.lote_stock(v_lote.id);
  if v_peso > v_stock then
    raise exception 'Stock insuficiente en el lote %: hay % kg', v_lote.codigo, round(v_stock, 3)
      using errcode = 'P0001', hint = 'stock_insuficiente';
  end if;

  insert into public.perdidas_lote (lote_id, fecha, peso_kg, motivo, detalle, usuario_id)
  values (
    v_lote.id, coalesce(p_fecha, current_date), v_peso, p_motivo,
    nullif(trim(coalesce(p_detalle, '')), ''), auth.uid()
  )
  returning id into v_id;

  insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
  values (v_lote.producto_id, v_lote.id, 'perdida', -v_peso, v_lote.costo_usd_kg, v_id);

  perform public.lote_sincronizar_estado(v_lote.id);
  return v_id;
end;
$$;

revoke all on function public.registrar_perdida(uuid, numeric, text, text, date) from public, anon;
grant execute on function public.registrar_perdida(uuid, numeric, text, text, date) to authenticated;

-- ============ cerrar_lote ============
-- Da de baja todo el remanente como pérdida `cierre` y marca `cerrado`.
-- `p_peso_esperado_kg` (opcional): los kg que el usuario confirmó; si el
-- stock cambió mientras tanto, falla para que vuelva a confirmar.
-- Devuelve { lote_id, peso_baja_kg }.
create or replace function public.cerrar_lote(
  p_lote_id uuid,
  p_detalle text default null,
  p_peso_esperado_kg numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.lotes%rowtype;
  v_stock numeric;
  v_perdida_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  select * into v_lote from public.lotes where id = p_lote_id for update;
  if v_lote.id is null then
    raise exception 'El lote no existe' using errcode = 'P0001', hint = 'lote_no_disponible';
  end if;
  if v_lote.estado = 'cerrado' then
    raise exception 'El lote % ya está cerrado', v_lote.codigo
      using errcode = 'P0001', hint = 'lote_no_disponible';
  end if;

  v_stock := public.lote_stock(v_lote.id);
  if p_peso_esperado_kg is not null and round(p_peso_esperado_kg, 3) <> round(v_stock, 3) then
    raise exception 'El stock del lote % cambió: ahora hay % kg', v_lote.codigo, round(v_stock, 3)
      using errcode = 'P0001', hint = 'stock_cambio';
  end if;

  if v_stock > 0 then
    insert into public.perdidas_lote (lote_id, fecha, peso_kg, motivo, detalle, usuario_id)
    values (
      v_lote.id, current_date, v_stock, 'cierre',
      nullif(trim(coalesce(p_detalle, '')), ''), auth.uid()
    )
    returning id into v_perdida_id;

    insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
    values (v_lote.producto_id, v_lote.id, 'perdida', -v_stock, v_lote.costo_usd_kg, v_perdida_id);
  end if;

  update public.lotes set estado = 'cerrado' where id = v_lote.id;

  return jsonb_build_object('lote_id', v_lote.id, 'peso_baja_kg', greatest(v_stock, 0));
end;
$$;

revoke all on function public.cerrar_lote(uuid, text, numeric) from public, anon;
grant execute on function public.cerrar_lote(uuid, text, numeric) to authenticated;

-- ============ Se retira el promedio ponderado ============
drop function if exists public.stock_y_costo_producto(uuid);
