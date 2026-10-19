-- 17-trazabilidad-y-correccion-facturas (2/3): RPC.
--
-- - corregir_linea_factura: corrige el peso y/o el precio/kg de UNA línea de
--   una factura no anulada, con motivo obligatorio. Solo admin. Atómica: lock
--   de la factura y después de los lotes (una sola sentencia ordenada por
--   `fecha_ingreso, codigo`, como `registrar_factura`), así se serializa con
--   abonos, notas de crédito, ventas y otras correcciones.
--     · Baja el peso: los kg vuelven a los lotes de la línea en orden inverso
--       (tope por lote: lo vendido menos lo devuelto por notas emitidas) y el
--       lote se reabre. Movimiento `correccion_venta` positivo.
--     · Sube el peso: primero los lotes de la línea (en su orden), luego PEPS
--       entre los demás lotes abiertos del producto; si no alcanza,
--       `stock_insuficiente` y no se guarda nada. Movimiento negativo.
--     · Sin control de stock: movimiento sin lote a costo 0.
--     · Recalcula costo snapshot, subtotal, IVA (con el `iva_pct` de la
--       factura), total y estado. Nunca toca la tasa ni los pagos.
-- - trazabilidad_factura: lectura (solo admin) de la factura con la cadena
--   compra → lote crudo → procesamiento → lote procesado → línea, notas de
--   crédito, pagos, correcciones y contrato activo. Márgenes y señales los
--   calcula TS (funciones puras de `lib/facturas`).
--
-- Errores (`errcode P0001`, `hint`): factura_anulada, sin_cambios,
-- peso_menor_devuelto, stock_insuficiente, linea_sin_lotes, motivo_requerido
-- (+ peso_invalido / precio_invalido para entradas fuera de rango).

-- ============ corregir_linea_factura ============
-- Devuelve (sin costos):
-- { correccion_id, subtotal_usd, iva_usd, total_usd, pagado_usd, saldo_usd,
--   saldo_a_favor_usd, estado, contrato: { id, numero, estado } | null,
--   lotes: [{ lote_id, codigo, peso_kg }] }   -- peso_kg: + vuelve al lote, − sale
create or replace function public.corregir_linea_factura(
  p_factura_item_id uuid,
  p_peso_kg numeric,
  p_precio_usd_kg numeric,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correccion_id uuid := gen_random_uuid();
  v_factura_id uuid;
  v_factura public.facturas%rowtype;
  v_fi public.factura_items%rowtype;
  v_producto public.productos%rowtype;
  v_contrato public.contratos%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_peso numeric;
  v_precio numeric;
  v_delta numeric;
  v_devueltos numeric;
  v_tiene_lotes boolean;
  v_resto numeric;
  v_toma numeric;
  v_ya numeric;
  v_stock numeric;
  v_orden int;
  v_fil record;
  v_lote record;
  v_costo numeric;
  v_subtotal numeric;
  v_iva numeric;
  v_total numeric;
  v_creditos numeric;
  v_saldo numeric;
  v_estado text;
  v_movs jsonb := '[]'::jsonb;
begin
  -- 1. Solo admin.
  if not public.es_admin() then
    raise exception 'Solo un administrador puede corregir facturas'
      using errcode = '42501';
  end if;

  select fi.factura_id into v_factura_id
  from public.factura_items fi
  where fi.id = p_factura_item_id;

  if v_factura_id is null then
    raise exception 'La línea de factura no existe' using errcode = 'P0002';
  end if;

  -- 2. Lock de la factura (serializa con pagos, notas y otras correcciones).
  select * into v_factura from public.facturas where id = v_factura_id for update;

  if v_factura.estado = 'anulada' then
    raise exception 'La factura está anulada: no se puede corregir'
      using errcode = 'P0001', hint = 'factura_anulada';
  end if;

  -- La línea solo cambia bajo el lock de su factura.
  select * into v_fi from public.factura_items where id = p_factura_item_id;
  select * into v_producto from public.productos where id = v_fi.producto_id;

  -- 3. Redondeo y validación.
  v_peso := round(p_peso_kg, 3);
  v_precio := round(p_precio_usd_kg, 6);

  if v_peso is null or v_peso <= 0 then
    raise exception 'El peso debe ser mayor a 0'
      using errcode = 'P0001', hint = 'peso_invalido';
  end if;
  if v_precio is null or v_precio < 0 then
    raise exception 'El precio no puede ser negativo'
      using errcode = 'P0001', hint = 'precio_invalido';
  end if;
  if char_length(v_motivo) < 5 then
    raise exception 'Indica el motivo de la corrección (mínimo 5 caracteres)'
      using errcode = 'P0001', hint = 'motivo_requerido';
  end if;
  if char_length(v_motivo) > 500 then
    raise exception 'El motivo admite hasta 500 caracteres'
      using errcode = 'P0001', hint = 'motivo_requerido';
  end if;
  if v_peso = v_fi.peso_kg and v_precio = v_fi.precio_usd_kg then
    raise exception 'El peso y el precio son iguales a los vigentes: no hay nada que corregir'
      using errcode = 'P0001', hint = 'sin_cambios';
  end if;

  -- 4. No bajar de lo devuelto por notas de crédito emitidas.
  select coalesce(sum(nci.peso_kg), 0) into v_devueltos
  from public.nota_credito_items nci
  join public.notas_credito nc on nc.id = nci.nota_credito_id
  where nci.factura_item_id = v_fi.id
    and nc.estado = 'emitida';

  if v_peso < v_devueltos then
    raise exception 'El peso no puede quedar por debajo de los % kg ya devueltos por notas de crédito',
      to_char(v_devueltos, 'FM999999990.000')
      using errcode = 'P0001', hint = 'peso_menor_devuelto';
  end if;

  -- 5. Stock.
  v_delta := v_peso - v_fi.peso_kg;
  v_tiene_lotes := exists (
    select 1 from public.factura_item_lotes where factura_item_id = v_fi.id
  );

  if v_delta <> 0 then
    if v_tiene_lotes then
      -- Lock de los lotes de la línea y, si sube, de los abiertos del
      -- producto: una sola sentencia en orden PEPS (evita interbloqueos con
      -- `registrar_factura`).
      perform 1
      from public.lotes l
      where l.id in (select fil.lote_id from public.factura_item_lotes fil where fil.factura_item_id = v_fi.id)
         or (v_delta > 0 and l.producto_id = v_fi.producto_id and l.estado = 'abierto')
      order by l.fecha_ingreso, l.codigo
      for update;

      if v_delta < 0 then
        -- ===== Baja: vuelve a los lotes en orden inverso =====
        v_resto := -v_delta;
        for v_fil in
          select fil.id, fil.lote_id, fil.peso_kg
          from public.factura_item_lotes fil
          where fil.factura_item_id = v_fi.id
          order by fil.orden desc
        loop
          exit when v_resto <= 0;

          -- Lo ya devuelto a este lote por notas emitidas no se devuelve dos veces.
          select coalesce(sum(ncil.peso_kg), 0) into v_ya
          from public.nota_credito_item_lotes ncil
          join public.nota_credito_items nci on nci.id = ncil.nota_credito_item_id
          join public.notas_credito nc on nc.id = nci.nota_credito_id
          where nci.factura_item_id = v_fi.id
            and ncil.lote_id = v_fil.lote_id
            and nc.estado = 'emitida';

          v_toma := least(v_resto, v_fil.peso_kg - v_ya);
          continue when v_toma <= 0;

          select l.id, l.codigo, l.producto_id, l.costo_usd_kg into v_lote
          from public.lotes l where l.id = v_fil.lote_id;

          if v_toma = v_fil.peso_kg then
            delete from public.factura_item_lotes where id = v_fil.id;
          else
            update public.factura_item_lotes set peso_kg = peso_kg - v_toma where id = v_fil.id;
          end if;

          insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
          values (v_lote.producto_id, v_lote.id, 'correccion_venta', v_toma, v_lote.costo_usd_kg, v_correccion_id);

          -- Recibe kg: vuelve a abierto (un lote cerrado no puede tener stock).
          update public.lotes set estado = 'abierto' where id = v_lote.id and estado <> 'abierto';

          v_movs := v_movs || jsonb_build_object('lote_id', v_lote.id, 'codigo', v_lote.codigo, 'peso_kg', v_toma);
          v_resto := v_resto - v_toma;
        end loop;

        if v_resto > 0 then
          raise exception 'No se pudieron devolver % kg a los lotes de la línea', v_resto
            using errcode = 'P0001', hint = 'peso_menor_devuelto';
        end if;
      else
        -- ===== Sube: lotes de la línea, luego PEPS del producto =====
        v_resto := v_delta;
        for v_lote in
          select l.id, l.codigo, l.producto_id, l.costo_usd_kg, fil.id as fil_id
          from public.lotes l
          left join public.factura_item_lotes fil
            on fil.lote_id = l.id and fil.factura_item_id = v_fi.id
          where l.producto_id = v_fi.producto_id
            and l.estado = 'abierto'
          order by (fil.id is null), fil.orden, l.fecha_ingreso, l.codigo
        loop
          exit when v_resto <= 0;
          v_stock := public.lote_stock(v_lote.id);
          continue when v_stock <= 0;
          v_toma := least(v_resto, v_stock);

          if v_lote.fil_id is not null then
            update public.factura_item_lotes set peso_kg = peso_kg + v_toma where id = v_lote.fil_id;
          else
            select coalesce(max(orden), 0) + 1 into v_orden
            from public.factura_item_lotes where factura_item_id = v_fi.id;
            insert into public.factura_item_lotes (factura_item_id, lote_id, orden, peso_kg, costo_usd_kg)
            values (v_fi.id, v_lote.id, v_orden, v_toma, v_lote.costo_usd_kg);
          end if;

          insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
          values (v_lote.producto_id, v_lote.id, 'correccion_venta', -v_toma, v_lote.costo_usd_kg, v_correccion_id);

          perform public.lote_sincronizar_estado(v_lote.id);

          v_movs := v_movs || jsonb_build_object('lote_id', v_lote.id, 'codigo', v_lote.codigo, 'peso_kg', -v_toma);
          v_resto := v_resto - v_toma;
        end loop;

        if v_resto > 0 then
          -- La excepción revierte todo lo hecho en la función: sin cambios parciales.
          raise exception 'Stock insuficiente de %: faltan % kg en lotes',
            v_producto.nombre, to_char(v_resto, 'FM999999990.000')
            using errcode = 'P0001', hint = 'stock_insuficiente';
        end if;
      end if;
    elsif v_producto.controla_stock then
      -- Dato legado: línea con control de stock sin asignación por lote.
      raise exception 'Esta línea no tiene lotes asignados: solo se puede corregir el precio'
        using errcode = 'P0001', hint = 'linea_sin_lotes';
    else
      -- Sin control de stock: espejo del movimiento `venta` sin lote.
      insert into public.movimientos (producto_id, lote_id, tipo, peso_kg, costo_usd_kg, ref_id)
      values (v_fi.producto_id, null, 'correccion_venta', -v_delta, 0, v_correccion_id);
    end if;
  end if;

  -- 6. Costo snapshot = promedio de la asignación vigente (0 sin lotes).
  --    Solo cambia si cambió el peso.
  if v_delta = 0 then
    v_costo := v_fi.costo_usd_kg;
  else
    select coalesce(round(sum(fil.peso_kg * fil.costo_usd_kg) / v_peso, 6), 0) into v_costo
    from public.factura_item_lotes fil
    where fil.factura_item_id = v_fi.id;
  end if;

  -- 7. Línea.
  update public.factura_items
  set peso_kg = v_peso,
      precio_usd_kg = v_precio,
      costo_usd_kg = v_costo
  where id = v_fi.id;

  -- 8. Totales con el IVA de la factura (mismo redondeo que subtotalItems / ivaSobre).
  select round(coalesce(sum(fi.peso_kg * fi.precio_usd_kg), 0), 6) into v_subtotal
  from public.factura_items fi
  where fi.factura_id = v_factura.id;
  v_iva := round(v_subtotal * v_factura.iva_pct / 100, 6);
  v_total := round(v_subtotal + v_iva, 6);

  -- 9. Estado (misma regla que registrar_pago).
  v_estado := case when v_total - v_factura.pagado_usd <= 0.000001 then 'pagada' else 'abierta' end;

  update public.facturas
  set subtotal_usd = v_subtotal,
      iva_usd = v_iva,
      total_usd = v_total,
      estado = v_estado
  where id = v_factura.id;

  -- 10. Historial (con el contrato activo, que queda desactualizado).
  select * into v_contrato
  from public.contratos ct
  where ct.factura_id = v_factura.id and ct.estado <> 'anulado'
  limit 1;

  insert into public.factura_correcciones (
    id, factura_id, factura_item_id,
    peso_anterior_kg, peso_nuevo_kg,
    precio_anterior_usd_kg, precio_nuevo_usd_kg,
    costo_anterior_usd_kg, costo_nuevo_usd_kg,
    subtotal_anterior_usd, subtotal_nuevo_usd,
    iva_anterior_usd, iva_nuevo_usd,
    total_anterior_usd, total_nuevo_usd,
    pagado_usd, estado_anterior, estado_nuevo,
    contrato_id, motivo
  ) values (
    v_correccion_id, v_factura.id, v_fi.id,
    v_fi.peso_kg, v_peso,
    v_fi.precio_usd_kg, v_precio,
    v_fi.costo_usd_kg, v_costo,
    v_factura.subtotal_usd, v_subtotal,
    v_factura.iva_usd, v_iva,
    v_factura.total_usd, v_total,
    v_factura.pagado_usd, v_factura.estado, v_estado,
    v_contrato.id, v_motivo
  );

  select coalesce(sum(nc.total_usd), 0) into v_creditos
  from public.notas_credito nc
  where nc.factura_id = v_factura.id and nc.estado = 'emitida';

  v_saldo := round(v_total - v_factura.pagado_usd - v_creditos, 6);

  return jsonb_build_object(
    'correccion_id', v_correccion_id,
    'subtotal_usd', v_subtotal,
    'iva_usd', v_iva,
    'total_usd', v_total,
    'pagado_usd', v_factura.pagado_usd,
    'saldo_usd', greatest(v_saldo, 0),
    'saldo_a_favor_usd', greatest(-v_saldo, 0),
    'estado', v_estado,
    'contrato', case
      when v_contrato.id is null then null
      else jsonb_build_object('id', v_contrato.id, 'numero', v_contrato.numero, 'estado', v_contrato.estado)
    end,
    'lotes', v_movs
  );
end;
$$;

revoke all on function public.corregir_linea_factura(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.corregir_linea_factura(uuid, numeric, numeric, text) to authenticated;

-- ============ trazabilidad_factura ============
-- Solo admin (muestra costos). `null` si la factura no existe.
create or replace function public.trazabilidad_factura(p_factura_id uuid)
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
    raise exception 'Solo un administrador puede ver la trazabilidad de una factura'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'factura', jsonb_build_object(
      'id', f.id,
      'numero', f.numero,
      'fecha', f.fecha,
      'condicion', f.condicion,
      'dias_credito', f.dias_credito,
      'fecha_vencimiento', f.fecha_vencimiento,
      'estado', f.estado,
      'tasa_snapshot', f.tasa_snapshot,
      'tasa_origen', f.tasa_origen,
      'tasa_fuente', f.tasa_fuente,
      'tasa_referencial', f.tasa_referencial,
      'iva_pct', f.iva_pct,
      'subtotal_usd', f.subtotal_usd,
      'iva_usd', f.iva_usd,
      'total_usd', f.total_usd,
      'pagado_usd', f.pagado_usd,
      'created_at', f.created_at,
      'cliente', jsonb_build_object(
        'id', cl.id,
        'nombre', cl.nombre,
        'rif_ci', cl.rif_ci,
        'limite_credito_usd', cl.limite_credito_usd,
        'bloqueado', cl.bloqueado
      )
    ),

    'lineas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fi.id,
        'producto', jsonb_build_object(
          'id', p.id,
          'nombre', p.nombre,
          'codigo', p.codigo,
          'tipo', p.tipo,
          'controla_stock', p.controla_stock,
          'precio_referencia_usd_kg', p.precio_referencia_usd_kg
        ),
        'peso_kg', fi.peso_kg,
        'precio_usd_kg', fi.precio_usd_kg,
        'costo_usd_kg', fi.costo_usd_kg,
        'kg_devueltos', coalesce((
          select sum(nci.peso_kg)
          from public.nota_credito_items nci
          join public.notas_credito nc on nc.id = nci.nota_credito_id
          where nci.factura_item_id = fi.id and nc.estado = 'emitida'
        ), 0),
        'lotes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'fil_id', fil.id,
            'orden', fil.orden,
            'peso_kg', fil.peso_kg,
            'costo_usd_kg', fil.costo_usd_kg,
            -- Lo ya devuelto a este lote por notas emitidas (tope al bajar el peso).
            'kg_devueltos', coalesce((
              select sum(ncil.peso_kg)
              from public.nota_credito_item_lotes ncil
              join public.nota_credito_items nci on nci.id = ncil.nota_credito_item_id
              join public.notas_credito nc on nc.id = nci.nota_credito_id
              where nci.factura_item_id = fi.id and ncil.lote_id = fil.lote_id and nc.estado = 'emitida'
            ), 0),
            'lote_id', l.id,
            'codigo', l.codigo,
            'origen', l.origen,
            'fecha_ingreso', l.fecha_ingreso,
            'estado', l.estado,
            'stock_kg', public.lote_stock(l.id),
            'moneda', l.moneda,
            'tasa_snapshot', l.tasa_snapshot,
            'lote_costo_usd_kg', l.costo_usd_kg,
            'proveedor_id', l.proveedor_id,
            'proveedor_nombre', pv.nombre,
            'compra_id', ci.compra_id,
            'compra_fecha', co.fecha,
            'proceso', case when l.origen <> 'proceso' then null else (
              select jsonb_build_object(
                'procesamiento_id', pr.id,
                'proceso_item_id', pi.id,
                'fecha', pr.fecha,
                'reparto_costo', pr.reparto_costo,
                -- Merma y rendimiento del proceso completo: cabecera (16) o,
                -- en legados sin cabecera, Σ proceso_items.
                'legado', pr.peso_entrada_kg is null,
                'peso_entrada_kg', coalesce(pr.peso_entrada_kg, (
                  select sum(x.peso_entrada_kg) from public.proceso_items x where x.procesamiento_id = pr.id
                )),
                'peso_salida_total_kg', (
                  select sum(x.peso_salida_kg) from public.proceso_items x where x.procesamiento_id = pr.id
                ),
                'salidas', (
                  select count(*) from public.proceso_items x where x.procesamiento_id = pr.id
                ),
                'peso_salida_kg', pi.peso_salida_kg,
                'costo_total_usd', pi.costo_total_usd,
                'precio_referencia_usd_kg', pi.precio_referencia_usd_kg,
                'lote_padre', jsonb_build_object(
                  'id', lp.id,
                  'codigo', lp.codigo,
                  'origen', lp.origen,
                  'producto_nombre', pp.nombre,
                  'fecha_ingreso', lp.fecha_ingreso,
                  'costo_usd_kg', lp.costo_usd_kg,
                  'moneda', lp.moneda,
                  'tasa_snapshot', lp.tasa_snapshot,
                  'peso_inicial_kg', lp.peso_inicial_kg,
                  'proveedor_id', lp.proveedor_id,
                  'proveedor_nombre', ppv.nombre,
                  'compra_id', pci.compra_id,
                  'compra_fecha', pco.fecha
                )
              )
              from public.proceso_items pi
              join public.procesamientos pr on pr.id = pi.procesamiento_id
              left join public.lotes lp on lp.id = l.lote_padre_id
              left join public.productos pp on pp.id = lp.producto_id
              left join public.proveedores ppv on ppv.id = lp.proveedor_id
              left join public.compra_items pci on pci.id = lp.compra_item_id
              left join public.compras pco on pco.id = pci.compra_id
              where pi.id = l.proceso_item_id
            ) end
          ) order by fil.orden)
          from public.factura_item_lotes fil
          join public.lotes l on l.id = fil.lote_id
          left join public.proveedores pv on pv.id = l.proveedor_id
          left join public.compra_items ci on ci.id = l.compra_item_id
          left join public.compras co on co.id = ci.compra_id
          where fil.factura_item_id = fi.id
        ), '[]'::jsonb)
      ) order by p.nombre, fi.id)
      from public.factura_items fi
      join public.productos p on p.id = fi.producto_id
      where fi.factura_id = f.id
    ), '[]'::jsonb),

    'notas_credito', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', nc.id,
        'numero', nc.numero,
        'fecha', nc.fecha,
        'motivo', nc.motivo,
        'estado', nc.estado,
        'subtotal_usd', nc.subtotal_usd,
        'iva_usd', nc.iva_usd,
        'total_usd', nc.total_usd,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', nci.id,
            'factura_item_id', nci.factura_item_id,
            'peso_kg', nci.peso_kg,
            'precio_usd_kg', nci.precio_usd_kg,
            'afecta_inventario', nci.afecta_inventario
          ) order by nci.id)
          from public.nota_credito_items nci
          where nci.nota_credito_id = nc.id
        ), '[]'::jsonb)
      ) order by nc.fecha, nc.numero)
      from public.notas_credito nc
      where nc.factura_id = f.id
    ), '[]'::jsonb),

    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pg.id,
        'fecha', pg.fecha,
        'monto_usd', pg.monto_usd,
        'moneda_pago', pg.moneda_pago,
        'tasa_pago', pg.tasa_pago,
        'metodo', pg.metodo,
        'ganancia_cambiaria_bs', pg.ganancia_cambiaria_bs
      ) order by pg.fecha, pg.created_at)
      from public.pagos pg
      where pg.factura_id = f.id
    ), '[]'::jsonb),

    'correcciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'factura_item_id', c.factura_item_id,
        'producto_nombre', cp.nombre,
        'peso_anterior_kg', c.peso_anterior_kg,
        'peso_nuevo_kg', c.peso_nuevo_kg,
        'precio_anterior_usd_kg', c.precio_anterior_usd_kg,
        'precio_nuevo_usd_kg', c.precio_nuevo_usd_kg,
        'costo_anterior_usd_kg', c.costo_anterior_usd_kg,
        'costo_nuevo_usd_kg', c.costo_nuevo_usd_kg,
        'subtotal_anterior_usd', c.subtotal_anterior_usd,
        'subtotal_nuevo_usd', c.subtotal_nuevo_usd,
        'iva_anterior_usd', c.iva_anterior_usd,
        'iva_nuevo_usd', c.iva_nuevo_usd,
        'total_anterior_usd', c.total_anterior_usd,
        'total_nuevo_usd', c.total_nuevo_usd,
        'pagado_usd', c.pagado_usd,
        'estado_anterior', c.estado_anterior,
        'estado_nuevo', c.estado_nuevo,
        'contrato_id', c.contrato_id,
        'contrato_numero', cct.numero,
        'motivo', c.motivo,
        'usuario_id', c.usuario_id,
        'usuario_nombre', pf.nombre,
        'created_at', c.created_at,
        'movimientos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'lote_id', m.lote_id,
            'codigo', ml.codigo,
            'peso_kg', m.peso_kg
          ) order by m.created_at, m.id)
          from public.movimientos m
          left join public.lotes ml on ml.id = m.lote_id
          where m.tipo = 'correccion_venta' and m.ref_id = c.id
        ), '[]'::jsonb)
      ) order by c.created_at desc)
      from public.factura_correcciones c
      join public.factura_items cfi on cfi.id = c.factura_item_id
      join public.productos cp on cp.id = cfi.producto_id
      left join public.perfiles pf on pf.id = c.usuario_id
      left join public.contratos cct on cct.id = c.contrato_id
      where c.factura_id = f.id
    ), '[]'::jsonb),

    'contrato', (
      select jsonb_build_object(
        'id', ct.id,
        'numero', ct.numero,
        'estado', ct.estado,
        'created_at', ct.created_at,
        'desactualizado', exists (
          select 1 from public.factura_correcciones c2
          where c2.factura_id = f.id and c2.created_at > ct.created_at
        )
      )
      from public.contratos ct
      where ct.factura_id = f.id and ct.estado <> 'anulado'
      limit 1
    )
  )
  into v_resultado
  from public.facturas f
  join public.clientes cl on cl.id = f.cliente_id
  where f.id = p_factura_id;

  return v_resultado;
end;
$$;

revoke all on function public.trazabilidad_factura(uuid) from public, anon;
grant execute on function public.trazabilidad_factura(uuid) to authenticated;
