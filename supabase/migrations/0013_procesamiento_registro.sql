-- Migration 013: registro atómico de procesamientos (04-inventario, §4.3).
--
-- Por qué la función calcula el costo (a diferencia de `registrar_compra`, que
-- solo inserta lo que calcula el servicio):
--   - El costo del lote es el costo promedio vigente del producto origen, que
--     sale del ledger `movimientos`. Desde 0003 el operador solo lee
--     `movimientos_view`, con el costo en `null`; el servicio, corriendo con
--     la sesión del operador, no puede conocerlo. La función es `security
--     definer`, lee la tabla base y nunca devuelve el costo al invocador.
--   - Leer el stock, validarlo y descontarlo tiene que ocurrir bajo un mismo
--     lock: dos lotes simultáneos del mismo crudo no deben dejarlo en negativo.
--
-- Fórmulas (/SPEC.md §4.1 y §4.3, mismas que `costingService.ts`):
--   - Costo promedio: las entradas suman `peso × costo`; las salidas restan al
--     costo promedio vigente (el promedio no cambia al sacar stock).
--   - Transferencia total: costo_total = peso_entrada × costo_kg_origen;
--     costo_kg_destino = costo_total / peso_salida (la merma encarece el kg).
--   - proceso_out: −peso_entrada al costo del origen; proceso_in: +peso_salida
--     al costo destino (mismo signo que la factory `crearMovimiento`).

-- ============ stock_y_costo_producto (interna) ============
-- Recorre el ledger en orden cronológico, igual que `costingService`.
-- No se expone a `authenticated`: devolvería el costo al operador.
create or replace function public.stock_y_costo_producto(
  p_producto_id uuid,
  out stock_kg numeric,
  out costo_usd_kg numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m record;
  v_costo_total numeric := 0;
begin
  stock_kg := 0;
  for m in
    select peso_kg, costo_usd_kg as costo
    from public.movimientos
    where producto_id = p_producto_id
    order by created_at, id
  loop
    if m.peso_kg > 0 then
      v_costo_total := v_costo_total + m.peso_kg * m.costo;
    elsif stock_kg > 0 then
      v_costo_total := v_costo_total + m.peso_kg * (v_costo_total / stock_kg);
    end if;
    stock_kg := stock_kg + m.peso_kg;
  end loop;

  costo_usd_kg := case when stock_kg > 0 then v_costo_total / stock_kg else 0 end;
end;
$$;

revoke all on function public.stock_y_costo_producto(uuid) from public, anon, authenticated;

-- Listado de procesamientos.
create index if not exists idx_proceso_items_procesamiento
  on public.proceso_items (procesamiento_id);

-- ============ registrar_procesamiento ============
-- Cualquier usuario autenticado (la limpieza la registra quien la hace, igual
-- que la recepción de compras). Devuelve solo el id: el costo no sale de aquí.
-- p_procesamiento: { id, fecha, notas }
-- p_items: [{ producto_origen_id, peso_entrada_kg, producto_destino_id, peso_salida_kg }]
create or replace function public.registrar_procesamiento(
  p_procesamiento jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := (p_procesamiento ->> 'id')::uuid;
  v_item record;
  v_origen public.productos%rowtype;
  v_destino public.productos%rowtype;
  v_stock numeric;
  v_costo_origen numeric;
  v_costo_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'El procesamiento debe tener al menos un lote' using errcode = '23514';
  end if;

  insert into public.procesamientos (id, fecha, notas)
  values (
    v_id,
    coalesce((p_procesamiento ->> 'fecha')::date, current_date),
    nullif(p_procesamiento ->> 'notas', '')
  );

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as i(
      producto_origen_id uuid,
      peso_entrada_kg numeric,
      producto_destino_id uuid,
      peso_salida_kg numeric
    )
  loop
    select * into v_origen from public.productos where id = v_item.producto_origen_id;
    select * into v_destino from public.productos where id = v_item.producto_destino_id;

    if v_origen.id is null or not v_origen.activo or v_origen.tipo <> 'crudo' then
      raise exception 'El producto origen debe ser un crudo activo'
        using errcode = 'P0001', hint = 'origen_invalido';
    end if;
    if v_destino.id is null or not v_destino.activo or v_destino.tipo <> 'procesado' then
      raise exception 'El producto destino debe ser un procesado activo'
        using errcode = 'P0001', hint = 'destino_invalido';
    end if;

    -- Serializa los lotes del mismo origen (ventas deberán tomar el mismo lock).
    perform pg_advisory_xact_lock(hashtext('stock:' || v_origen.id::text));

    select s.stock_kg, s.costo_usd_kg into v_stock, v_costo_origen
    from public.stock_y_costo_producto(v_origen.id) s;

    -- Tolerancia de redondeo de numeric(12,3).
    if v_origen.controla_stock and v_item.peso_entrada_kg > v_stock + 0.0005 then
      raise exception 'Stock insuficiente de %: hay % kg y se quieren procesar % kg',
        v_origen.nombre, round(v_stock, 3), round(v_item.peso_entrada_kg, 3)
        using errcode = 'P0001', hint = 'stock_insuficiente';
    end if;

    v_costo_origen := round(v_costo_origen, 6);
    v_costo_total := round(v_item.peso_entrada_kg * v_costo_origen, 6);

    -- `salida_menor_entrada` (0001) rechaza peso_salida > peso_entrada.
    insert into public.proceso_items (
      procesamiento_id, producto_origen_id, peso_entrada_kg,
      producto_destino_id, peso_salida_kg, costo_total_usd
    ) values (
      v_id, v_origen.id, v_item.peso_entrada_kg,
      v_destino.id, v_item.peso_salida_kg, v_costo_total
    );

    insert into public.movimientos (producto_id, tipo, peso_kg, costo_usd_kg, ref_id)
    values
      (v_origen.id, 'proceso_out', -v_item.peso_entrada_kg, v_costo_origen, v_id),
      (v_destino.id, 'proceso_in', v_item.peso_salida_kg,
        round(v_costo_total / v_item.peso_salida_kg, 6), v_id);
  end loop;

  return v_id;
end;
$$;

revoke all on function public.registrar_procesamiento(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_procesamiento(jsonb, jsonb) to authenticated;
