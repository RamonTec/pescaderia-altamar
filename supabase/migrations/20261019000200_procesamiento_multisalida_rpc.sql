-- 16-procesamiento-multisalida (3/3): RPC `registrar_procesamiento` (reemplazo).
--
-- Un lote crudo + un peso de entrada → N salidas (1–10) de procesados
-- distintos del mismo crudo, cada una con su lote hijo. Reemplaza la versión
-- de 20261007180300 (una línea = un lote crudo = un lote procesado).
--
-- Cálculo (espejo exacto de `repartirCostoProceso` / `prorratearEntrada` en
-- `src/lib/services/costingService.ts`): todo en enteros (milésimas de kg,
-- micro-USD) con redondeo half-up, para que la UI y la base den lo mismo.
--   1. costo_total = round(entrada × costo_lote, 6).
--   2. Peso de reparto w_i = kg_i × precio_i (por valor). Con una sola
--      salida, o si Σ w = 0 (todos los precios en 0), w_i = kg_i (por peso).
--   3. costo_i = round(costo_total × w_i / Σ w, 6); el residuo va a la salida
--      de mayor w (la primera si empatan): Σ costo_i = costo_total exacto.
--   4. costo_kg_i = round(costo_i / kg_i, 6) → lote hijo y `proceso_in`.
--   5. Entrada prorrateada por kg: e_i = floor(entrada × kg_i / Σ kg, 3) y
--      las milésimas que faltan, de a una, por mayor resto. Garantiza
--      e_i ≥ kg_i (`salida_menor_entrada`) y Σ e_i = entrada.
--
-- Precios: el del catálogo manda (se lee en esta transacción). Si el
-- catálogo no tiene precio y llega uno en el payload, se usa y se guarda en
-- el catálogo solo si sigue vacío. Con ≥ 2 salidas toda salida necesita
-- precio (`precio_requerido`).
--
-- Errores nuevos (`P0001`, `detail = 'salida:N'` con N desde 0, el índice
-- de la salida en `p_salidas`): `salidas_exceden_entrada`,
-- `salida_duplicada`, `precio_requerido`. Se conservan
-- `lote_no_disponible`, `origen_invalido`, `destino_invalido`,
-- `destino_no_corresponde` y `stock_insuficiente`.

-- ============ Funciones internas de cálculo (no expuestas) ============

-- round(a / b) half-up para enteros a ≥ 0, b > 0 (división entera exacta).
create or replace function public.procesamiento_div_redondeo(p_a numeric, p_b numeric)
returns numeric
language sql
immutable
strict
set search_path = public
as $$
  select div(2 * p_a + p_b, 2 * p_b)
$$;

revoke all on function public.procesamiento_div_redondeo(numeric, numeric) from public, anon, authenticated;

-- Reparte `p_total_micro` (micro-USD, entero ≥ 0) según los pesos enteros
-- `p_pesos` (≥ 0, Σ > 0). Devuelve micro-USD por posición; el residuo va al
-- de mayor peso (el primero si empatan).
create or replace function public.procesamiento_repartir_costo(p_total_micro numeric, p_pesos numeric[])
returns numeric[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_n int := coalesce(array_length(p_pesos, 1), 0);
  v_suma numeric := 0;
  v_max int := 1;
  v_asignado numeric := 0;
  v_res numeric[] := '{}';
  i int;
begin
  if v_n = 0 then
    return v_res;
  end if;
  for i in 1..v_n loop
    v_suma := v_suma + p_pesos[i];
    if p_pesos[i] > p_pesos[v_max] then
      v_max := i;
    end if;
  end loop;
  if v_suma <= 0 then
    raise exception 'Los pesos de reparto deben sumar más de 0' using errcode = '23514';
  end if;
  for i in 1..v_n loop
    v_res[i] := public.procesamiento_div_redondeo(p_total_micro * p_pesos[i], v_suma);
    v_asignado := v_asignado + v_res[i];
  end loop;
  v_res[v_max] := v_res[v_max] + (p_total_micro - v_asignado);
  return v_res;
end;
$$;

revoke all on function public.procesamiento_repartir_costo(numeric, numeric[]) from public, anon, authenticated;

-- Prorratea `p_entrada_mil` (milésimas de kg, entero) según `p_kgs_mil`
-- (milésimas, > 0): floor + mayor resto (el primero si empatan).
create or replace function public.procesamiento_prorratear_entrada(p_entrada_mil numeric, p_kgs_mil numeric[])
returns numeric[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_n int := coalesce(array_length(p_kgs_mil, 1), 0);
  v_suma numeric := 0;
  v_res numeric[] := '{}';
  v_restos numeric[] := '{}';
  v_asignado numeric := 0;
  v_faltan numeric;
  v_mejor int;
  i int;
begin
  if v_n = 0 then
    return v_res;
  end if;
  for i in 1..v_n loop
    v_suma := v_suma + p_kgs_mil[i];
  end loop;
  for i in 1..v_n loop
    v_res[i] := div(p_entrada_mil * p_kgs_mil[i], v_suma);
    v_restos[i] := mod(p_entrada_mil * p_kgs_mil[i], v_suma);
    v_asignado := v_asignado + v_res[i];
  end loop;
  v_faltan := p_entrada_mil - v_asignado;
  while v_faltan > 0 loop
    v_mejor := 1;
    for i in 2..v_n loop
      if v_restos[i] > v_restos[v_mejor] then
        v_mejor := i;
      end if;
    end loop;
    v_res[v_mejor] := v_res[v_mejor] + 1;
    -- Ya recibió su milésima: no vuelve a competir.
    v_restos[v_mejor] := -1;
    v_faltan := v_faltan - 1;
  end loop;
  return v_res;
end;
$$;

revoke all on function public.procesamiento_prorratear_entrada(numeric, numeric[]) from public, anon, authenticated;

-- ============ registrar_procesamiento ============
-- p_procesamiento: { id, fecha, notas, lote_origen_id, peso_entrada_kg }
-- p_salidas: [{ producto_destino_id, peso_salida_kg, precio_referencia_usd_kg? }]
-- Devuelve { procesamiento_id, reparto_costo,
--            lotes: [{ lote_id, codigo, producto_id, peso_kg }] } (sin costos).
drop function if exists public.registrar_procesamiento(jsonb, jsonb);

create or replace function public.registrar_procesamiento(
  p_procesamiento jsonb,
  p_salidas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_salidas constant int := 10;
  v_id uuid := (p_procesamiento ->> 'id')::uuid;
  v_fecha date := coalesce((p_procesamiento ->> 'fecha')::date, current_date);
  v_lote_id uuid := nullif(p_procesamiento ->> 'lote_origen_id', '')::uuid;
  v_entrada numeric := round((p_procesamiento ->> 'peso_entrada_kg')::numeric, 3);
  v_n int := jsonb_array_length(coalesce(p_salidas, '[]'::jsonb));
  v_lote public.lotes%rowtype;
  v_origen public.productos%rowtype;
  v_destino public.productos%rowtype;
  v_stock numeric;
  v_salida record;
  v_idx int;
  v_kg numeric;
  v_precio numeric;
  v_destinos uuid[] := '{}';
  v_controla boolean[] := '{}';
  v_kgs numeric[] := '{}';
  v_kgs_mil numeric[] := '{}';
  v_precios numeric[] := '{}';
  v_pesos numeric[] := '{}';
  v_suma_kg numeric := 0;
  v_suma_valor numeric := 0;
  v_reparto text;
  v_costo_total numeric;
  v_costos_micro numeric[];
  v_entradas_mil numeric[];
  v_costo numeric;
  v_costo_kg numeric;
  v_proceso_item_id uuid;
  v_lote_destino_id uuid;
  v_codigo text;
  v_lotes jsonb := '[]'::jsonb;
  i int;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  if v_n = 0 then
    raise exception 'El procesamiento debe tener al menos una salida' using errcode = '23514';
  end if;
  if v_n > c_max_salidas then
    raise exception 'Un procesamiento admite como máximo % salidas', c_max_salidas
      using errcode = '23514';
  end if;

  -- ---------- Origen (bajo lock de la fila del lote) ----------
  if v_lote_id is null then
    raise exception 'Elige el lote de origen'
      using errcode = 'P0001', hint = 'lote_no_disponible';
  end if;

  -- Dos operaciones sobre el mismo lote se serializan y nunca lo dejan en
  -- negativo.
  select * into v_lote from public.lotes where id = v_lote_id for update;
  if v_lote.id is null then
    raise exception 'El lote no existe' using errcode = 'P0001', hint = 'lote_no_disponible';
  end if;

  select * into v_origen from public.productos where id = v_lote.producto_id;
  if not v_origen.activo or v_origen.tipo <> 'crudo' then
    raise exception 'El producto origen debe ser un crudo activo'
      using errcode = 'P0001', hint = 'origen_invalido';
  end if;
  if v_lote.estado <> 'abierto' then
    raise exception 'El lote % no está abierto', v_lote.codigo
      using errcode = 'P0001', hint = 'lote_no_disponible';
  end if;

  if v_entrada is null or v_entrada <= 0 then
    raise exception 'El peso de entrada debe ser mayor a 0' using errcode = '23514';
  end if;

  v_stock := public.lote_stock(v_lote.id);
  if v_entrada > v_stock then
    raise exception 'Stock insuficiente en el lote %: hay % kg y se quieren procesar % kg',
      v_lote.codigo, round(v_stock, 3), v_entrada
      using errcode = 'P0001', hint = 'stock_insuficiente';
  end if;

  -- ---------- Salidas ----------
  for v_salida in
    select
      (e.n - 1)::int as idx,
      nullif(e.value ->> 'producto_destino_id', '')::uuid as producto_destino_id,
      (e.value ->> 'peso_salida_kg')::numeric as peso_salida_kg,
      nullif(e.value ->> 'precio_referencia_usd_kg', '')::numeric as precio
    from jsonb_array_elements(p_salidas) with ordinality as e(value, n)
    order by e.n
  loop
    v_idx := v_salida.idx;
    select * into v_destino from public.productos where id = v_salida.producto_destino_id;

    if v_destino.id is null or not v_destino.activo or v_destino.tipo <> 'procesado' then
      raise exception 'El producto destino debe ser un procesado activo'
        using errcode = 'P0001', hint = 'destino_invalido', detail = 'salida:' || v_idx;
    end if;
    if v_destino.producto_origen_id is distinct from v_origen.id then
      raise exception '% no se obtiene de %', v_destino.nombre, v_origen.nombre
        using errcode = 'P0001', hint = 'destino_no_corresponde', detail = 'salida:' || v_idx;
    end if;
    if v_destino.id = any(v_destinos) then
      raise exception '% aparece en más de una salida', v_destino.nombre
        using errcode = 'P0001', hint = 'salida_duplicada', detail = 'salida:' || v_idx;
    end if;

    v_kg := round(v_salida.peso_salida_kg, 3);
    if v_kg is null or v_kg <= 0 then
      raise exception 'El peso de salida debe ser mayor a 0'
        using errcode = '23514', detail = 'salida:' || v_idx;
    end if;

    -- Precio: el del catálogo manda; si falta, el del payload.
    v_precio := v_destino.precio_referencia_usd_kg;
    if v_precio is null and v_salida.precio is not null then
      if v_salida.precio < 0 then
        raise exception 'El precio de referencia no puede ser negativo'
          using errcode = '23514', detail = 'salida:' || v_idx;
      end if;
      v_precio := round(v_salida.precio, 6);
      -- Solo rellena el catálogo si sigue vacío: nunca pisa un precio.
      update public.productos
      set precio_referencia_usd_kg = v_precio
      where id = v_destino.id and precio_referencia_usd_kg is null;
    end if;
    if v_precio is null and v_n >= 2 then
      raise exception 'Indica el precio de referencia de %', v_destino.nombre
        using errcode = 'P0001', hint = 'precio_requerido', detail = 'salida:' || v_idx;
    end if;

    v_destinos := v_destinos || v_destino.id;
    v_controla := v_controla || v_destino.controla_stock;
    v_kgs := v_kgs || v_kg;
    v_kgs_mil := v_kgs_mil || round(v_kg * 1000);
    v_precios := v_precios || v_precio;
    v_suma_kg := v_suma_kg + v_kg;
    v_suma_valor := v_suma_valor + coalesce(round(v_kg * 1000) * round(v_precio * 1000000), 0);
  end loop;

  if v_suma_kg > v_entrada then
    raise exception 'Las salidas (% kg) superan la entrada (% kg)', v_suma_kg, v_entrada
      using errcode = 'P0001', hint = 'salidas_exceden_entrada', detail = 'salida:' || (v_n - 1);
  end if;

  -- ---------- Reparto del costo ----------
  if v_n >= 2 and v_suma_valor > 0 then
    v_reparto := 'valor';
    for i in 1..v_n loop
      v_pesos[i] := round(v_kgs[i] * 1000) * round(v_precios[i] * 1000000);
    end loop;
  else
    -- Una sola salida (100 % del costo) o todos los precios en 0.
    v_reparto := 'peso';
    v_pesos := v_kgs_mil;
  end if;

  v_costo_total := round(v_entrada * v_lote.costo_usd_kg, 6);
  v_costos_micro := public.procesamiento_repartir_costo(round(v_costo_total * 1000000), v_pesos);
  v_entradas_mil := public.procesamiento_prorratear_entrada(round(v_entrada * 1000), v_kgs_mil);

  -- ---------- Escritura ----------
  insert into public.procesamientos (
    id, fecha, notas, lote_origen_id, peso_entrada_kg, costo_total_usd, reparto_costo
  ) values (
    v_id, v_fecha, nullif(p_procesamiento ->> 'notas', ''), v_lote.id, v_entrada,
    v_costo_total, v_reparto
  );

  -- Un solo `proceso_out` por la entrada completa, al costo del lote crudo.
  insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
  values (v_origen.id, v_lote.id, 'proceso_out', -v_entrada, v_lote.costo_usd_kg, v_id);

  for i in 1..v_n loop
    v_costo := v_costos_micro[i] / 1000000;
    v_costo_kg := public.procesamiento_div_redondeo(v_costos_micro[i] * 1000, v_kgs_mil[i]) / 1000000;

    -- `salida_menor_entrada` (0001) se cumple: e_i ≥ kg_i por construcción.
    insert into public.proceso_items (
      procesamiento_id, producto_origen_id, lote_origen_id, peso_entrada_kg,
      producto_destino_id, peso_salida_kg, costo_total_usd, precio_referencia_usd_kg
    ) values (
      v_id, v_origen.id, v_lote.id, v_entradas_mil[i] / 1000,
      v_destinos[i], v_kgs[i], v_costo, v_precios[i]
    )
    returning id into v_proceso_item_id;

    if v_controla[i] then
      v_codigo := public.generar_codigo_lote(v_destinos[i], v_fecha);

      -- Cada salida nace como lote hijo: hereda proveedor, moneda y tasa.
      insert into public.lotes (
        codigo, producto_id, origen, proceso_item_id, lote_padre_id, proveedor_id,
        fecha_ingreso, peso_inicial_kg, costo_usd_kg, moneda, tasa_snapshot
      ) values (
        v_codigo, v_destinos[i], 'proceso', v_proceso_item_id, v_lote.id, v_lote.proveedor_id,
        v_fecha, v_kgs[i], v_costo_kg, v_lote.moneda, v_lote.tasa_snapshot
      )
      returning id into v_lote_destino_id;

      v_lotes := v_lotes || jsonb_build_object(
        'lote_id', v_lote_destino_id,
        'codigo', v_codigo,
        'producto_id', v_destinos[i],
        'peso_kg', v_kgs[i]
      );
    else
      v_lote_destino_id := null;
    end if;

    insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
    values (v_destinos[i], v_lote_destino_id, 'proceso_in', v_kgs[i], v_costo_kg, v_id);
  end loop;

  perform public.lote_sincronizar_estado(v_lote.id);

  return jsonb_build_object(
    'procesamiento_id', v_id,
    'reparto_costo', v_reparto,
    'lotes', v_lotes
  );
end;
$$;

revoke all on function public.registrar_procesamiento(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_procesamiento(jsonb, jsonb) to authenticated;
