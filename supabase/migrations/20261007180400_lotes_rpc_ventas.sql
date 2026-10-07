-- 07-lotes (5/5): ventas y notas de crédito por lote.
--
-- - sugerir_lotes: asignación PEPS de lectura (sin costos) para la UI.
-- - registrar_factura: pasa a `security definer` con `auth.uid()`
--   obligatorio. Recibe la asignación por item o la calcula con PEPS, valida
--   stock bajo lock de la fila de cada lote, calcula el costo desde los lotes
--   (ya no lo manda el servicio: corrige el hallazgo 1, costo 0 cuando vende
--   un operador) y escribe `factura_item_lotes` + un movimiento `venta` por
--   asignación (corrige el hallazgo 2: ya no se vende sin stock). Ya no recibe
--   `p_movimientos`.
--   Parte de la última versión (20261007170000_cartera_vencimientos.sql):
--   conserva `dias_credito` (09; `fecha_vencimiento` la deriva el trigger) y
--   la procedencia de la tasa (08: tasa_origen, tasa_fuente,
--   tasa_referencial; `tasa_registrada_por` lo fija el trigger de 0019).
-- - registrar_nota_credito / anular_nota_credito (misma firma que 0016):
--   la devolución con `afecta_inventario` vuelve a los lotes de origen en
--   orden inverso de la asignación, al costo de cada lote, y reabre el lote;
--   anular revierte exactamente esos kg (falla si ya se usaron).
--
-- Errores con `hint` para que el servicio los mapee al item
-- (`detail = 'item:<índice desde 0>'`): stock_insuficiente,
-- lote_no_disponible, asignacion_no_cuadra.

-- ============ sugerir_lotes ============
-- Devuelve { controla_stock, suficiente, disponible_kg, faltante_kg,
--            asignacion: [{ lote_id, codigo, fecha_ingreso, disponible_kg, peso_kg }] }
-- PEPS: `fecha_ingreso`, luego `codigo`, entre lotes `abierto` con stock.
create or replace function public.sugerir_lotes(p_producto_id uuid, p_peso_kg numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_producto public.productos%rowtype;
  v_resto numeric := greatest(round(coalesce(p_peso_kg, 0), 3), 0);
  v_total numeric := 0;
  v_lote record;
  v_toma numeric;
  v_asignacion jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  select * into v_producto from public.productos where id = p_producto_id;
  if v_producto.id is null then
    raise exception 'El producto no existe' using errcode = 'P0002';
  end if;

  if not v_producto.controla_stock then
    return jsonb_build_object(
      'controla_stock', false, 'suficiente', true,
      'disponible_kg', null, 'faltante_kg', 0, 'asignacion', '[]'::jsonb
    );
  end if;

  for v_lote in
    select l.id, l.codigo, l.fecha_ingreso, s.stock_kg
    from public.lotes l
    join lateral (
      select coalesce(sum(m.peso_kg), 0) as stock_kg
      from public.movimientos m where m.lote_id = l.id
    ) s on true
    where l.producto_id = p_producto_id
      and l.estado = 'abierto'
      and s.stock_kg > 0
    order by l.fecha_ingreso, l.codigo
  loop
    v_total := v_total + v_lote.stock_kg;
    if v_resto > 0 then
      v_toma := least(v_resto, v_lote.stock_kg);
      v_resto := v_resto - v_toma;
      v_asignacion := v_asignacion || jsonb_build_object(
        'lote_id', v_lote.id,
        'codigo', v_lote.codigo,
        'fecha_ingreso', v_lote.fecha_ingreso,
        'disponible_kg', v_lote.stock_kg,
        'peso_kg', v_toma
      );
    end if;
  end loop;

  return jsonb_build_object(
    'controla_stock', true,
    'suficiente', v_resto <= 0,
    'disponible_kg', v_total,
    'faltante_kg', greatest(v_resto, 0),
    'asignacion', v_asignacion
  );
end;
$$;

revoke all on function public.sugerir_lotes(uuid, numeric) from public, anon;
grant execute on function public.sugerir_lotes(uuid, numeric) to authenticated;

-- ============ registrar_factura ============
-- p_factura: { id, cliente_id, fecha, condicion, dias_credito, tasa_snapshot,
--              iva_pct, subtotal_usd, iva_usd, total_usd, pagado_usd, estado,
--              tasa_origen?, tasa_fuente?, tasa_referencial? }
-- p_items: [{ producto_id, peso_kg, precio_usd_kg,
--             asignaciones?: [{ lote_id, peso_kg }] }]   (sin costo)
-- p_pedido_id: si es la entrega de un pedido, su id (opcional).
-- p_pesos_reales: [{ pedido_item_id, peso_kg }] (opcional).
drop function if exists public.registrar_factura(jsonb, jsonb, jsonb, uuid, jsonb);

create or replace function public.registrar_factura(
  p_factura jsonb,
  p_items jsonb,
  p_pedido_id uuid default null,
  p_pesos_reales jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := (p_factura ->> 'id')::uuid;
  v_pedido public.pedidos%rowtype;
  v_peso record;
  v_item record;
  v_asig record;
  v_producto public.productos%rowtype;
  v_lote public.lotes%rowtype;
  v_detalle text;
  v_peso_item numeric;
  v_suma numeric;
  v_resto numeric;
  v_stock numeric;
  v_toma numeric;
  v_lote_ids uuid[];
  v_pesos numeric[];
  v_costos numeric[];
  v_costo_total numeric;
  v_costo_item numeric;
  v_item_id uuid;
  v_i int;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La factura debe tener al menos un item' using errcode = '23514';
  end if;

  -- Entrega de pedido: bloquea el pedido para que no se facture dos veces.
  if p_pedido_id is not null then
    select * into v_pedido from public.pedidos where id = p_pedido_id for update;
    if v_pedido.id is null then
      raise exception 'El pedido no existe' using errcode = 'P0002';
    end if;
    if v_pedido.estado <> 'pendiente' then
      raise exception 'El pedido no está pendiente de entrega'
        using errcode = 'P0001', hint = 'pedido_no_pendiente';
    end if;
  end if;

  insert into public.facturas (
    id, cliente_id, pedido_id, fecha, condicion, dias_credito, tasa_snapshot, iva_pct,
    subtotal_usd, iva_usd, total_usd, pagado_usd, estado,
    tasa_origen, tasa_fuente, tasa_referencial
  ) values (
    v_id,
    (p_factura ->> 'cliente_id')::uuid,
    p_pedido_id,
    coalesce((p_factura ->> 'fecha')::date, current_date),
    p_factura ->> 'condicion',
    case
      when p_factura ->> 'condicion' = 'contado' then 0
      else coalesce(nullif(p_factura ->> 'dias_credito', '')::int, 0)
    end,
    (p_factura ->> 'tasa_snapshot')::numeric,
    (p_factura ->> 'iva_pct')::numeric,
    (p_factura ->> 'subtotal_usd')::numeric,
    (p_factura ->> 'iva_usd')::numeric,
    (p_factura ->> 'total_usd')::numeric,
    (p_factura ->> 'pagado_usd')::numeric,
    p_factura ->> 'estado',
    coalesce(p_factura ->> 'tasa_origen', 'referencial'),
    nullif(p_factura ->> 'tasa_fuente', ''),
    case
      when coalesce(p_factura ->> 'tasa_origen', 'referencial') = 'referencial'
        then (p_factura ->> 'tasa_snapshot')::numeric
      else nullif(p_factura ->> 'tasa_referencial', '')::numeric
    end
  );

  for v_item in
    select
      (e.value ->> 'producto_id')::uuid as producto_id,
      (e.value ->> 'peso_kg')::numeric as peso_kg,
      (e.value ->> 'precio_usd_kg')::numeric as precio_usd_kg,
      e.value -> 'asignaciones' as asignaciones,
      e.n - 1 as indice
    from jsonb_array_elements(p_items) with ordinality as e(value, n)
    order by e.n
  loop
    v_detalle := 'item:' || v_item.indice;

    select * into v_producto from public.productos where id = v_item.producto_id;
    if v_producto.id is null or not v_producto.activo then
      raise exception 'Producto no disponible'
        using errcode = 'P0001', hint = 'producto_no_disponible', detail = v_detalle;
    end if;

    v_peso_item := round(v_item.peso_kg, 3);
    if v_peso_item is null or v_peso_item <= 0 then
      raise exception 'El peso debe ser mayor a 0' using errcode = '23514', detail = v_detalle;
    end if;

    v_lote_ids := '{}';
    v_pesos := '{}';
    v_costos := '{}';

    if v_producto.controla_stock then
      if jsonb_typeof(v_item.asignaciones) = 'array'
        and jsonb_array_length(v_item.asignaciones) > 0 then
        -- ===== Asignación elegida por el vendedor =====
        if exists (
          select 1 from jsonb_array_elements(v_item.asignaciones) a
          where coalesce((a ->> 'peso_kg')::numeric, 0) < 0
        ) then
          raise exception 'Los kg asignados no pueden ser negativos'
            using errcode = 'P0001', hint = 'asignacion_no_cuadra', detail = v_detalle;
        end if;

        select coalesce(sum(round((a ->> 'peso_kg')::numeric, 3)), 0) into v_suma
        from jsonb_array_elements(v_item.asignaciones) a;

        if v_suma <> v_peso_item then
          raise exception 'Los lotes asignados suman % kg y la línea pesa % kg', v_suma, v_peso_item
            using errcode = 'P0001', hint = 'asignacion_no_cuadra', detail = v_detalle;
        end if;

        -- Bloquea todos los lotes en orden PEPS (mismo orden que la
        -- asignación automática: evita interbloqueos entre ventas).
        perform 1
        from public.lotes l
        where l.id in (
          select (a ->> 'lote_id')::uuid from jsonb_array_elements(v_item.asignaciones) a
        )
        order by l.fecha_ingreso, l.codigo
        for update;

        for v_asig in
          select (a.value ->> 'lote_id')::uuid as lote_id,
                 sum(round((a.value ->> 'peso_kg')::numeric, 3)) as peso_kg
          from jsonb_array_elements(v_item.asignaciones) with ordinality as a(value, n)
          group by (a.value ->> 'lote_id')::uuid
          having sum(round((a.value ->> 'peso_kg')::numeric, 3)) > 0
          order by min(a.n)
        loop
          select * into v_lote from public.lotes where id = v_asig.lote_id;
          if v_lote.id is null or v_lote.producto_id <> v_producto.id then
            raise exception 'El lote elegido no es de %', v_producto.nombre
              using errcode = 'P0001', hint = 'lote_no_disponible', detail = v_detalle;
          end if;
          if v_lote.estado <> 'abierto' then
            raise exception 'El lote % no está abierto', v_lote.codigo
              using errcode = 'P0001', hint = 'lote_no_disponible', detail = v_detalle;
          end if;
          v_stock := public.lote_stock(v_lote.id);
          if v_asig.peso_kg > v_stock then
            raise exception 'Stock insuficiente en el lote %: hay % kg y se asignan % kg',
              v_lote.codigo, round(v_stock, 3), v_asig.peso_kg
              using errcode = 'P0001', hint = 'stock_insuficiente', detail = v_detalle;
          end if;
          v_lote_ids := v_lote_ids || v_lote.id;
          v_pesos := v_pesos || v_asig.peso_kg;
          v_costos := v_costos || v_lote.costo_usd_kg;
        end loop;
      else
        -- ===== PEPS automático (el más antiguo primero) =====
        v_resto := v_peso_item;
        for v_lote in
          select *
          from public.lotes
          where producto_id = v_producto.id and estado = 'abierto'
          order by fecha_ingreso, codigo
          for update
        loop
          exit when v_resto <= 0;
          v_stock := public.lote_stock(v_lote.id);
          continue when v_stock <= 0;
          v_toma := least(v_resto, v_stock);
          v_lote_ids := v_lote_ids || v_lote.id;
          v_pesos := v_pesos || v_toma;
          v_costos := v_costos || v_lote.costo_usd_kg;
          v_resto := v_resto - v_toma;
        end loop;

        if v_resto > 0 then
          raise exception 'Stock insuficiente de %: faltan % kg en lotes', v_producto.nombre, v_resto
            using errcode = 'P0001', hint = 'stock_insuficiente', detail = v_detalle;
        end if;
      end if;

      -- Costo de la línea = promedio de su asignación (§4.6).
      v_costo_total := 0;
      for v_i in 1 .. coalesce(array_length(v_lote_ids, 1), 0) loop
        v_costo_total := v_costo_total + v_pesos[v_i] * v_costos[v_i];
      end loop;
      v_costo_item := round(v_costo_total / v_peso_item, 6);
    else
      -- Sin control de stock: sin lotes, sin costo de inventario.
      v_costo_item := 0;
    end if;

    insert into public.factura_items (factura_id, producto_id, peso_kg, precio_usd_kg, costo_usd_kg)
    values (v_id, v_producto.id, v_peso_item, round(v_item.precio_usd_kg, 6), v_costo_item)
    returning id into v_item_id;

    if v_producto.controla_stock then
      for v_i in 1 .. array_length(v_lote_ids, 1) loop
        insert into public.factura_item_lotes (factura_item_id, lote_id, orden, peso_kg, costo_usd_kg)
        values (v_item_id, v_lote_ids[v_i], v_i, v_pesos[v_i], v_costos[v_i]);

        insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
        values (v_producto.id, v_lote_ids[v_i], 'venta', -v_pesos[v_i], v_costos[v_i], v_id);

        perform public.lote_sincronizar_estado(v_lote_ids[v_i]);
      end loop;
    else
      insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
      values (v_producto.id, null, 'venta', -v_peso_item, 0, v_id);
    end if;
  end loop;

  -- Entrega de pedido: marcar facturado y guardar el peso real por item.
  if p_pedido_id is not null then
    update public.pedidos set estado = 'facturado' where id = p_pedido_id;

    for v_peso in
      select * from jsonb_to_recordset(coalesce(p_pesos_reales, '[]'::jsonb))
        as x(pedido_item_id uuid, peso_kg numeric)
    loop
      update public.pedido_items
      set peso_entregado_kg = v_peso.peso_kg
      where id = v_peso.pedido_item_id and pedido_id = p_pedido_id;
    end loop;
  end if;

  return v_id;
end;
$$;

revoke all on function public.registrar_factura(jsonb, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.registrar_factura(jsonb, jsonb, uuid, jsonb) to authenticated;

-- ============ registrar_nota_credito ============
-- Igual que 0016 (solo admin, security definer, lock de la factura, control
-- de devolución que excede), con la devolución a inventario por lote.
-- p_nota: { id, factura_id, fecha, motivo, subtotal_usd, iva_usd, total_usd }
-- p_items: [{ factura_item_id, peso_kg, precio_usd_kg, afecta_inventario }]
create or replace function public.registrar_nota_credito(
  p_nota jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := (p_nota ->> 'id')::uuid;
  v_factura_id uuid := (p_nota ->> 'factura_id')::uuid;
  v_item record;
  v_fi public.factura_items%rowtype;
  v_fil record;
  v_lote public.lotes%rowtype;
  v_disponible numeric;
  v_nci_id uuid;
  v_resto numeric;
  v_ya numeric;
  v_toma numeric;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede emitir notas de crédito'
      using errcode = '42501';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La nota de crédito debe tener al menos un item' using errcode = '23514';
  end if;

  -- Bloquea la factura para impedir dos notas concurrentes sobre la misma.
  perform 1 from public.facturas where id = v_factura_id for update;

  for v_item in
    select * from jsonb_to_recordset(p_items)
      as i(factura_item_id uuid, peso_kg numeric, precio_usd_kg numeric, afecta_inventario boolean)
  loop
    select fi.peso_kg - coalesce((
      select sum(nci.peso_kg)
      from public.nota_credito_items nci
      join public.notas_credito nc on nc.id = nci.nota_credito_id
      where nci.factura_item_id = v_item.factura_item_id
        and nc.estado = 'emitida'
    ), 0)
    into v_disponible
    from public.factura_items fi
    where fi.id = v_item.factura_item_id and fi.factura_id = v_factura_id;

    if v_disponible is null then
      raise exception 'El item de factura no existe' using errcode = 'P0002';
    end if;

    if v_item.peso_kg > v_disponible + 0.000001 then
      raise exception 'El peso a devolver (% kg) supera el disponible (% kg)',
        round(v_item.peso_kg, 3), round(v_disponible, 3)
        using errcode = 'P0001', hint = 'devolucion_excede';
    end if;
  end loop;

  insert into public.notas_credito (
    id, factura_id, fecha, motivo, subtotal_usd, iva_usd, total_usd, estado
  ) values (
    v_id,
    v_factura_id,
    coalesce((p_nota ->> 'fecha')::date, current_date),
    p_nota ->> 'motivo',
    (p_nota ->> 'subtotal_usd')::numeric,
    (p_nota ->> 'iva_usd')::numeric,
    (p_nota ->> 'total_usd')::numeric,
    'emitida'
  );

  for v_item in
    select * from jsonb_to_recordset(p_items)
      as i(factura_item_id uuid, peso_kg numeric, precio_usd_kg numeric, afecta_inventario boolean)
  loop
    insert into public.nota_credito_items (
      nota_credito_id, factura_item_id, peso_kg, precio_usd_kg, afecta_inventario
    ) values (
      v_id, v_item.factura_item_id, v_item.peso_kg, v_item.precio_usd_kg,
      coalesce(v_item.afecta_inventario, false)
    )
    returning id into v_nci_id;

    continue when not coalesce(v_item.afecta_inventario, false);

    select * into v_fi from public.factura_items where id = v_item.factura_item_id;

    if not exists (select 1 from public.factura_item_lotes where factura_item_id = v_fi.id) then
      -- Producto sin control de stock (sin lotes): ajuste sin lote, como 0016.
      insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
      values (v_fi.producto_id, null, 'ajuste', round(v_item.peso_kg, 3), v_fi.costo_usd_kg, v_id);
      continue;
    end if;

    -- Vuelve a los lotes de origen en orden inverso de la asignación, sin
    -- superar lo que se vendió de cada lote menos lo ya devuelto a él.
    v_resto := round(v_item.peso_kg, 3);
    for v_fil in
      select fil.lote_id, fil.peso_kg
      from public.factura_item_lotes fil
      where fil.factura_item_id = v_fi.id
      order by fil.orden desc
    loop
      exit when v_resto <= 0;

      select coalesce(sum(ncil.peso_kg), 0) into v_ya
      from public.nota_credito_item_lotes ncil
      join public.nota_credito_items nci on nci.id = ncil.nota_credito_item_id
      join public.notas_credito nc on nc.id = nci.nota_credito_id
      where nci.factura_item_id = v_fi.id
        and ncil.lote_id = v_fil.lote_id
        and nc.estado = 'emitida'
        and nci.id <> v_nci_id;

      v_toma := least(v_resto, v_fil.peso_kg - v_ya);
      continue when v_toma <= 0;

      select * into v_lote from public.lotes where id = v_fil.lote_id for update;

      insert into public.nota_credito_item_lotes (nota_credito_item_id, lote_id, peso_kg)
      values (v_nci_id, v_lote.id, v_toma);

      insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
      values (v_lote.producto_id, v_lote.id, 'ajuste', v_toma, v_lote.costo_usd_kg, v_id);

      -- Recibe kg de vuelta: el lote vuelve a estar abierto (también si se
      -- había cerrado: un lote cerrado no puede tener stock).
      update public.lotes set estado = 'abierto' where id = v_lote.id and estado <> 'abierto';

      v_resto := v_resto - v_toma;
    end loop;

    if v_resto > 0 then
      raise exception 'No se pudieron devolver % kg a los lotes de origen', v_resto
        using errcode = 'P0001', hint = 'devolucion_excede';
    end if;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.registrar_nota_credito(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_nota_credito(jsonb, jsonb) to authenticated;

-- ============ anular_nota_credito ============
-- Solo admin. Revierte exactamente los kg que la nota devolvió a cada lote
-- (bajo lock; falla si ese stock ya se volvió a vender o se dio de baja) y
-- pasa la nota a 'anulada'.
create or replace function public.anular_nota_credito(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota public.notas_credito%rowtype;
  v_dev record;
  v_lote public.lotes%rowtype;
  v_stock numeric;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede anular notas de crédito'
      using errcode = '42501';
  end if;

  select * into v_nota
  from public.notas_credito
  where id = p_id
  for update;

  if not found then
    raise exception 'La nota de crédito no existe' using errcode = 'P0002';
  end if;

  if v_nota.estado <> 'emitida' then
    raise exception 'La nota de crédito ya está anulada'
      using errcode = 'P0001', hint = 'nota_no_emitida';
  end if;

  update public.notas_credito set estado = 'anulada' where id = p_id;

  -- Devoluciones por lote.
  for v_dev in
    select ncil.lote_id, sum(ncil.peso_kg) as peso_kg
    from public.nota_credito_item_lotes ncil
    join public.nota_credito_items nci on nci.id = ncil.nota_credito_item_id
    where nci.nota_credito_id = p_id
    group by ncil.lote_id
  loop
    select * into v_lote from public.lotes where id = v_dev.lote_id for update;
    v_stock := public.lote_stock(v_lote.id);
    if v_dev.peso_kg > v_stock then
      raise exception 'El lote % ya no tiene los % kg devueltos (hay % kg): no se puede anular la nota',
        v_lote.codigo, v_dev.peso_kg, round(v_stock, 3)
        using errcode = 'P0001', hint = 'stock_insuficiente';
    end if;

    insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
    values (v_lote.producto_id, v_lote.id, 'ajuste', -v_dev.peso_kg, v_lote.costo_usd_kg, p_id);

    perform public.lote_sincronizar_estado(v_lote.id);
  end loop;

  -- Productos sin lotes (sin control de stock): revierte el ajuste de 0016.
  insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
  select fi.producto_id, null, 'ajuste', -nci.peso_kg, fi.costo_usd_kg, p_id
  from public.nota_credito_items nci
  join public.factura_items fi on fi.id = nci.factura_item_id
  where nci.nota_credito_id = p_id
    and nci.afecta_inventario
    and not exists (
      select 1 from public.factura_item_lotes fil where fil.factura_item_id = fi.id
    );
end;
$$;

revoke all on function public.anular_nota_credito(uuid) from public, anon;
grant execute on function public.anular_nota_credito(uuid) to authenticated;
