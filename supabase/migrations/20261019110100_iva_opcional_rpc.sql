-- 18-iva-opcional (2/2): RPC.
--
-- - cambiar_iva_factura: activa o quita el IVA de una factura emitida no
--   anulada, con motivo obligatorio. Solo admin. Atómica: lock de la factura
--   y después de sus notas de crédito emitidas (por `id`), así se serializa
--   con abonos, notas, correcciones de línea y otros cambios de IVA. No
--   mueve stock ni toca líneas.
--     · Al activar se usa el `config_negocio.iva_pct` vigente; activar en
--       una factura que ya tiene IVA no la re-tasa (`sin_cambios`).
--     · Recalcula IVA, total y estado (subtotal igual) con el mismo redondeo
--       que subtotalItems / ivaSobre, y el IVA y total de las notas emitidas.
--     · Nunca toca la tasa, los pagos ni la ganancia cambiaria.
--     · Una fila `tipo = 'iva'` en factura_correcciones: marca el contrato
--       activo como desactualizado (derivado, 17).
-- - trazabilidad_factura: misma definición que 20261019100100 con las
--   correcciones de los dos tipos (`left join` a la línea) y sus campos nuevos.
--
-- Errores (`errcode P0001`, `hint`): factura_anulada, sin_cambios,
-- iva_config_cero, motivo_requerido.

-- ============ cambiar_iva_factura ============
-- Devuelve (sin costos):
-- { correccion_id, iva_pct, subtotal_usd, iva_usd, total_usd, pagado_usd,
--   creditos_usd, saldo_usd, saldo_a_favor_usd, estado,
--   contrato: { id, numero, estado } | null }
create or replace function public.cambiar_iva_factura(
  p_factura_id uuid,
  p_aplica_iva boolean,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correccion_id uuid := gen_random_uuid();
  v_factura public.facturas%rowtype;
  v_contrato public.contratos%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_config numeric;
  v_iva_pct numeric;
  v_iva numeric;
  v_total numeric;
  v_creditos_anterior numeric;
  v_creditos_nuevo numeric;
  v_saldo numeric;
  v_estado text;
begin
  -- 1. Solo admin.
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar el IVA de una factura'
      using errcode = '42501';
  end if;

  if p_aplica_iva is null then
    raise exception 'Indica si la factura lleva IVA' using errcode = '22004';
  end if;

  -- 2. Lock de la factura (serializa con pagos, notas y correcciones).
  select * into v_factura from public.facturas where id = p_factura_id for update;

  if v_factura.id is null then
    raise exception 'La factura no existe' using errcode = 'P0002';
  end if;

  if v_factura.estado = 'anulada' then
    raise exception 'La factura está anulada: no se puede cambiar su IVA'
      using errcode = 'P0001', hint = 'factura_anulada';
  end if;

  -- 3. Motivo.
  if char_length(v_motivo) < 5 then
    raise exception 'Indica el motivo del cambio (mínimo 5 caracteres)'
      using errcode = 'P0001', hint = 'motivo_requerido';
  end if;
  if char_length(v_motivo) > 500 then
    raise exception 'El motivo admite hasta 500 caracteres'
      using errcode = 'P0001', hint = 'motivo_requerido';
  end if;

  -- 4. % nuevo: el configurado vigente o 0. Sin re-tasar.
  if (v_factura.iva_pct > 0) = p_aplica_iva then
    raise exception '%',
      case when p_aplica_iva then 'La factura ya tiene IVA' else 'La factura ya no tiene IVA' end
      using errcode = 'P0001', hint = 'sin_cambios';
  end if;

  if p_aplica_iva then
    select c.iva_pct into v_config from public.config_negocio c where c.id = 1;
    if coalesce(v_config, 0) = 0 then
      raise exception 'El IVA configurado es 0 %%: no hay IVA que aplicar'
        using errcode = 'P0001', hint = 'iva_config_cero';
    end if;
    v_iva_pct := v_config;
  else
    v_iva_pct := 0;
  end if;

  -- 5. Lock de las notas emitidas (después de la factura, por id).
  perform 1
  from public.notas_credito nc
  where nc.factura_id = v_factura.id and nc.estado = 'emitida'
  order by nc.id
  for update;

  select coalesce(sum(nc.total_usd), 0) into v_creditos_anterior
  from public.notas_credito nc
  where nc.factura_id = v_factura.id and nc.estado = 'emitida';

  -- 6. Totales (subtotal no cambia; mismo redondeo que ivaSobre).
  v_iva := round(v_factura.subtotal_usd * v_iva_pct / 100, 6);
  v_total := round(v_factura.subtotal_usd + v_iva, 6);

  -- 7. Notas emitidas al % nuevo (subtotal, ítems y kg intactos).
  update public.notas_credito nc
  set iva_usd = round(nc.subtotal_usd * v_iva_pct / 100, 6),
      total_usd = round(nc.subtotal_usd + round(nc.subtotal_usd * v_iva_pct / 100, 6), 6)
  where nc.factura_id = v_factura.id and nc.estado = 'emitida';

  select coalesce(sum(nc.total_usd), 0) into v_creditos_nuevo
  from public.notas_credito nc
  where nc.factura_id = v_factura.id and nc.estado = 'emitida';

  -- 8. Estado (misma regla que registrar_pago y corregir_linea_factura).
  v_estado := case when v_total - v_factura.pagado_usd <= 0.000001 then 'pagada' else 'abierta' end;

  -- 9. Factura.
  update public.facturas
  set iva_pct = v_iva_pct,
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
    id, factura_id, tipo, factura_item_id,
    subtotal_anterior_usd, subtotal_nuevo_usd,
    iva_anterior_usd, iva_nuevo_usd,
    total_anterior_usd, total_nuevo_usd,
    iva_pct_anterior, iva_pct_nuevo,
    creditos_anterior_usd, creditos_nuevo_usd,
    pagado_usd, estado_anterior, estado_nuevo,
    contrato_id, motivo
  ) values (
    v_correccion_id, v_factura.id, 'iva', null,
    v_factura.subtotal_usd, v_factura.subtotal_usd,
    v_factura.iva_usd, v_iva,
    v_factura.total_usd, v_total,
    v_factura.iva_pct, v_iva_pct,
    v_creditos_anterior, v_creditos_nuevo,
    v_factura.pagado_usd, v_factura.estado, v_estado,
    v_contrato.id, v_motivo
  );

  v_saldo := round(v_total - v_factura.pagado_usd - v_creditos_nuevo, 6);

  return jsonb_build_object(
    'correccion_id', v_correccion_id,
    'iva_pct', v_iva_pct,
    'subtotal_usd', v_factura.subtotal_usd,
    'iva_usd', v_iva,
    'total_usd', v_total,
    'pagado_usd', v_factura.pagado_usd,
    'creditos_usd', v_creditos_nuevo,
    'saldo_usd', greatest(v_saldo, 0),
    'saldo_a_favor_usd', greatest(-v_saldo, 0),
    'estado', v_estado,
    'contrato', case
      when v_contrato.id is null then null
      else jsonb_build_object('id', v_contrato.id, 'numero', v_contrato.numero, 'estado', v_contrato.estado)
    end
  );
end;
$$;

revoke all on function public.cambiar_iva_factura(uuid, boolean, text) from public, anon;
grant execute on function public.cambiar_iva_factura(uuid, boolean, text) to authenticated;

-- ============ trazabilidad_factura ============
-- Solo admin (muestra costos). `null` si la factura no existe.
-- 18: correcciones con `left join` a la línea (las de tipo iva no tienen) y
-- los campos tipo, iva_pct_anterior/_nuevo y creditos_anterior/_nuevo_usd.
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
        'tipo', c.tipo,
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
        'iva_pct_anterior', c.iva_pct_anterior,
        'iva_pct_nuevo', c.iva_pct_nuevo,
        'creditos_anterior_usd', c.creditos_anterior_usd,
        'creditos_nuevo_usd', c.creditos_nuevo_usd,
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
      left join public.factura_items cfi on cfi.id = c.factura_item_id
      left join public.productos cp on cp.id = cfi.producto_id
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
