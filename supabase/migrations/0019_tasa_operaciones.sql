-- Migration 019: procedencia de la tasa en cada operación (08-tasas).
--
-- El snapshot del valor usado (`tasa_snapshot`/`tasa_pago`) ya existía y no
-- cambia (/SPEC.md §2: nunca se recalcula la historia). Se agrega de dónde
-- vino: referencial o manual, de qué fuente, cuánto era la referencial y
-- quién la registró. Con una manual, la desviación
-- `(tasa_snapshot / tasa_referencial - 1)` queda calculable para el control
-- del admin.
--
-- Las RPC de 0012/0016 se redefinen con la MISMA firma: solo agregan las
-- columnas nuevas al insert. Si el JSON trae `tasa_origen='referencial'`,
-- no se confía en el `tasa_referencial` del cliente: se usa el valor final
-- (`tasa_snapshot`/`tasa_pago`) que ya recibía la función, con lo que el
-- check de coherencia no puede fallar por datos del cliente.

-- ============ COLUMNAS ============
alter table public.compras
  add column tasa_origen text not null default 'referencial'
    check (tasa_origen in ('referencial', 'manual')),
  add column tasa_fuente text check (tasa_fuente in ('bcv', 'paralela')),
  add column tasa_referencial numeric(14,6),
  add column tasa_registrada_por uuid references public.perfiles(id);

alter table public.facturas
  add column tasa_origen text not null default 'referencial'
    check (tasa_origen in ('referencial', 'manual')),
  add column tasa_fuente text check (tasa_fuente in ('bcv', 'paralela')),
  add column tasa_referencial numeric(14,6),
  add column tasa_registrada_por uuid references public.perfiles(id);

alter table public.pagos
  add column tasa_origen text not null default 'referencial'
    check (tasa_origen in ('referencial', 'manual')),
  add column tasa_fuente text check (tasa_fuente in ('bcv', 'paralela')),
  add column tasa_referencial numeric(14,6),
  add column tasa_registrada_por uuid references public.perfiles(id);

alter table public.pagos_proveedores
  add column tasa_origen text not null default 'referencial'
    check (tasa_origen in ('referencial', 'manual')),
  add column tasa_fuente text check (tasa_fuente in ('bcv', 'paralela')),
  add column tasa_referencial numeric(14,6),
  add column tasa_registrada_por uuid references public.perfiles(id);

-- Backfill: lo ya registrado se tomó de la referencial; el valor vigente era
-- el propio snapshot. Añadir el check DESPUÉS para que valide las filas ya
-- migradas.
update public.compras set tasa_referencial = tasa_snapshot;
update public.facturas set tasa_referencial = tasa_snapshot;
update public.pagos set tasa_referencial = tasa_pago;
update public.pagos_proveedores set tasa_referencial = tasa_pago;

-- ============ CHECK DE COHERENCIA ============
-- Si la operación usó la referencial, el snapshot debe ser exactamente esa
-- referencial (con una manual, la diferencia queda calculable).
alter table public.compras
  add constraint compras_tasa_coherente
  check (tasa_origen <> 'referencial' or tasa_referencial = tasa_snapshot);

alter table public.facturas
  add constraint facturas_tasa_coherente
  check (tasa_origen <> 'referencial' or tasa_referencial = tasa_snapshot);

alter table public.pagos
  add constraint pagos_tasa_coherente
  check (tasa_origen <> 'referencial' or tasa_referencial = tasa_pago);

alter table public.pagos_proveedores
  add constraint pagos_proveedores_tasa_coherente
  check (tasa_origen <> 'referencial' or tasa_referencial = tasa_pago);

-- ============ TRIGGER: usuario que registró ============
-- El cliente no fija el usuario; lo fija la base. Queda null si escribe una
-- sesión sin usuario (service_role del cron u otra escritura de servidor).
create or replace function public.fija_tasa_registrada_por()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tasa_registrada_por is null then
    new.tasa_registrada_por := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists compras_tasa_registrada_por on public.compras;
create trigger compras_tasa_registrada_por
  before insert on public.compras
  for each row execute function public.fija_tasa_registrada_por();

drop trigger if exists facturas_tasa_registrada_por on public.facturas;
create trigger facturas_tasa_registrada_por
  before insert on public.facturas
  for each row execute function public.fija_tasa_registrada_por();

drop trigger if exists pagos_tasa_registrada_por on public.pagos;
create trigger pagos_tasa_registrada_por
  before insert on public.pagos
  for each row execute function public.fija_tasa_registrada_por();

drop trigger if exists pagos_proveedores_tasa_registrada_por on public.pagos_proveedores;
create trigger pagos_proveedores_tasa_registrada_por
  before insert on public.pagos_proveedores
  for each row execute function public.fija_tasa_registrada_por();

-- ============ registrar_compra ============
-- Igual que 0012 (security invoker: respeta las políticas de insert de
-- 0001), insertando además la procedencia de la tasa.
-- p_compra: { id, proveedor_id, fecha, condicion, moneda, tasa_snapshot,
--             subtotal_usd, pagado_usd, estado, notas,
--             tasa_origen?, tasa_fuente?, tasa_referencial? }
create or replace function public.registrar_compra(
  p_compra jsonb,
  p_items jsonb,
  p_movimientos jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (p_compra ->> 'id')::uuid;
begin
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La compra debe tener al menos un item' using errcode = '23514';
  end if;

  insert into public.compras (
    id, proveedor_id, fecha, condicion, moneda, tasa_snapshot,
    subtotal_usd, pagado_usd, estado, notas,
    tasa_origen, tasa_fuente, tasa_referencial
  ) values (
    v_id,
    (p_compra ->> 'proveedor_id')::uuid,
    (p_compra ->> 'fecha')::date,
    p_compra ->> 'condicion',
    p_compra ->> 'moneda',
    (p_compra ->> 'tasa_snapshot')::numeric,
    (p_compra ->> 'subtotal_usd')::numeric,
    (p_compra ->> 'pagado_usd')::numeric,
    p_compra ->> 'estado',
    nullif(p_compra ->> 'notas', ''),
    coalesce(p_compra ->> 'tasa_origen', 'referencial'),
    nullif(p_compra ->> 'tasa_fuente', ''),
    case
      when coalesce(p_compra ->> 'tasa_origen', 'referencial') = 'referencial'
        then (p_compra ->> 'tasa_snapshot')::numeric
      else nullif(p_compra ->> 'tasa_referencial', '')::numeric
    end
  );

  insert into public.compra_items (compra_id, producto_id, peso_kg, costo_usd_kg)
  select v_id, i.producto_id, i.peso_kg, i.costo_usd_kg
  from jsonb_to_recordset(p_items)
    as i(producto_id uuid, peso_kg numeric, costo_usd_kg numeric);

  insert into public.movimientos (producto_id, tipo, peso_kg, costo_usd_kg, ref_id)
  select m.producto_id, m.tipo, m.peso_kg, m.costo_usd_kg, m.ref_id
  from jsonb_to_recordset(coalesce(p_movimientos, '[]'::jsonb))
    as m(producto_id uuid, tipo text, peso_kg numeric, costo_usd_kg numeric, ref_id uuid);

  return v_id;
end;
$$;

revoke all on function public.registrar_compra(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_compra(jsonb, jsonb, jsonb) to authenticated;

-- ============ registrar_pago_proveedor ============
-- Igual que 0012 (solo admin, security definer, bloqueo de la compra).
-- p_pago: { compra_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo,
--           ganancia_cambiaria_bs, tasa_origen?, tasa_fuente?, tasa_referencial? }
create or replace function public.registrar_pago_proveedor(p_pago jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compra public.compras%rowtype;
  v_monto numeric := (p_pago ->> 'monto_usd')::numeric;
  v_saldo numeric;
  v_pago_id uuid;
begin
  -- Cuentas por pagar = balances: solo admin (/SPEC.md §5, RLS por rol).
  if not public.es_admin() then
    raise exception 'Solo un administrador puede registrar pagos a proveedores'
      using errcode = '42501';
  end if;

  select * into v_compra
  from public.compras
  where id = (p_pago ->> 'compra_id')::uuid
  for update;

  if not found then
    raise exception 'La compra no existe' using errcode = 'P0002';
  end if;

  if v_compra.estado <> 'abierta' then
    raise exception 'La compra no tiene saldo pendiente'
      using errcode = 'P0001', hint = 'compra_no_abierta';
  end if;

  v_saldo := v_compra.subtotal_usd - v_compra.pagado_usd;
  -- Tolerancia de redondeo de numeric(14,6).
  if v_monto > v_saldo + 0.000001 then
    raise exception 'El monto (% USD) supera el saldo pendiente (% USD)',
      round(v_monto, 2), round(v_saldo, 2)
      using errcode = 'P0001', hint = 'sobrepago';
  end if;

  insert into public.pagos_proveedores (
    compra_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo,
    ganancia_cambiaria_bs, tasa_origen, tasa_fuente, tasa_referencial
  ) values (
    v_compra.id,
    coalesce((p_pago ->> 'fecha')::date, current_date),
    least(v_monto, v_saldo),
    p_pago ->> 'moneda_pago',
    (p_pago ->> 'tasa_pago')::numeric,
    p_pago ->> 'metodo',
    coalesce((p_pago ->> 'ganancia_cambiaria_bs')::numeric, 0),
    coalesce(p_pago ->> 'tasa_origen', 'referencial'),
    nullif(p_pago ->> 'tasa_fuente', ''),
    case
      when coalesce(p_pago ->> 'tasa_origen', 'referencial') = 'referencial'
        then (p_pago ->> 'tasa_pago')::numeric
      else nullif(p_pago ->> 'tasa_referencial', '')::numeric
    end
  )
  returning id into v_pago_id;

  update public.compras
  set pagado_usd = pagado_usd + least(v_monto, v_saldo),
      estado = case
        when subtotal_usd - (pagado_usd + least(v_monto, v_saldo)) <= 0.000001 then 'pagada'
        else 'abierta'
      end
  where id = v_compra.id;

  return v_pago_id;
end;
$$;

revoke all on function public.registrar_pago_proveedor(jsonb) from public, anon;
grant execute on function public.registrar_pago_proveedor(jsonb) to authenticated;

-- ============ registrar_factura ============
-- Igual que 0016 (security invoker: respeta las políticas de insert de
-- 0001; `numero` se llena con la secuencia de 0013).
-- p_factura: { id, cliente_id, fecha, condicion, tasa_snapshot, iva_pct,
--              subtotal_usd, iva_usd, total_usd, pagado_usd, estado,
--              tasa_origen?, tasa_fuente?, tasa_referencial? }
create or replace function public.registrar_factura(
  p_factura jsonb,
  p_items jsonb,
  p_movimientos jsonb,
  p_pedido_id uuid default null,
  p_pesos_reales jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (p_factura ->> 'id')::uuid;
  v_peso record;
begin
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La factura debe tener al menos un item' using errcode = '23514';
  end if;

  insert into public.facturas (
    id, cliente_id, pedido_id, fecha, condicion, tasa_snapshot, iva_pct,
    subtotal_usd, iva_usd, total_usd, pagado_usd, estado,
    tasa_origen, tasa_fuente, tasa_referencial
  ) values (
    v_id,
    (p_factura ->> 'cliente_id')::uuid,
    p_pedido_id,
    coalesce((p_factura ->> 'fecha')::date, current_date),
    p_factura ->> 'condicion',
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

  insert into public.factura_items (factura_id, producto_id, peso_kg, precio_usd_kg, costo_usd_kg)
  select v_id, i.producto_id, i.peso_kg, i.precio_usd_kg, i.costo_usd_kg
  from jsonb_to_recordset(p_items)
    as i(producto_id uuid, peso_kg numeric, precio_usd_kg numeric, costo_usd_kg numeric);

  insert into public.movimientos (producto_id, tipo, peso_kg, costo_usd_kg, ref_id)
  select m.producto_id, m.tipo, m.peso_kg, m.costo_usd_kg, m.ref_id
  from jsonb_to_recordset(coalesce(p_movimientos, '[]'::jsonb))
    as m(producto_id uuid, tipo text, peso_kg numeric, costo_usd_kg numeric, ref_id uuid);

  -- Entrega de pedido: marcar facturado y guardar el peso real por item.
  if p_pedido_id is not null then
    update public.pedidos set estado = 'facturado' where id = p_pedido_id;

    for v_peso in
      select * from jsonb_to_recordset(coalesce(p_pesos_reales, '[]'::jsonb))
        as x(pedido_item_id uuid, peso_kg numeric)
    loop
      update public.pedido_items
      set peso_entregado_kg = v_peso.peso_kg
      where id = v_peso.pedido_item_id;
    end loop;
  end if;

  return v_id;
end;
$$;

revoke all on function public.registrar_factura(jsonb, jsonb, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.registrar_factura(jsonb, jsonb, jsonb, uuid, jsonb) to authenticated;

-- ============ registrar_pago ============
-- Igual que 0016 (solo admin, security definer, bloqueo de la factura).
-- p_pago: { factura_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo,
--           ganancia_cambiaria_bs, tasa_origen?, tasa_fuente?, tasa_referencial? }
create or replace function public.registrar_pago(p_pago jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_factura public.facturas%rowtype;
  v_monto numeric := (p_pago ->> 'monto_usd')::numeric;
  v_saldo numeric;
  v_pago_id uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede registrar cobros'
      using errcode = '42501';
  end if;

  select * into v_factura
  from public.facturas
  where id = (p_pago ->> 'factura_id')::uuid
  for update;

  if not found then
    raise exception 'La factura no existe' using errcode = 'P0002';
  end if;

  if v_factura.estado <> 'abierta' then
    raise exception 'La factura no tiene saldo pendiente'
      using errcode = 'P0001', hint = 'factura_no_abierta';
  end if;

  v_saldo := v_factura.total_usd - v_factura.pagado_usd;
  if v_monto > v_saldo + 0.000001 then
    raise exception 'El monto (% USD) supera el saldo pendiente (% USD)',
      round(v_monto, 2), round(v_saldo, 2)
      using errcode = 'P0001', hint = 'sobrepago';
  end if;

  insert into public.pagos (
    factura_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo,
    ganancia_cambiaria_bs, tasa_origen, tasa_fuente, tasa_referencial
  ) values (
    v_factura.id,
    coalesce((p_pago ->> 'fecha')::date, current_date),
    least(v_monto, v_saldo),
    p_pago ->> 'moneda_pago',
    (p_pago ->> 'tasa_pago')::numeric,
    p_pago ->> 'metodo',
    coalesce((p_pago ->> 'ganancia_cambiaria_bs')::numeric, 0),
    coalesce(p_pago ->> 'tasa_origen', 'referencial'),
    nullif(p_pago ->> 'tasa_fuente', ''),
    case
      when coalesce(p_pago ->> 'tasa_origen', 'referencial') = 'referencial'
        then (p_pago ->> 'tasa_pago')::numeric
      else nullif(p_pago ->> 'tasa_referencial', '')::numeric
    end
  )
  returning id into v_pago_id;

  update public.facturas
  set pagado_usd = pagado_usd + least(v_monto, v_saldo),
      estado = case
        when total_usd - (pagado_usd + least(v_monto, v_saldo)) <= 0.000001 then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_pago_id;
end;
$$;

revoke all on function public.registrar_pago(jsonb) from public, anon;
grant execute on function public.registrar_pago(jsonb) to authenticated;

-- ============ config_negocio ============
-- Umbral de desviación de una tasa manual contra la referencial: la UI pide
-- confirmación si lo supera (evita errores de tipeo de un orden de
-- magnitud). La fila única ya existe (0011): el default la cubre.
alter table public.config_negocio
  add column if not exists umbral_desviacion_tasa_pct numeric(5,2) not null default 10;
