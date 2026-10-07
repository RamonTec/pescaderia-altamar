-- Migration 014: notas de crédito y escritura atómica de ventas (05-ventas).
--
-- 1. Tablas `notas_credito` y `nota_credito_items` + secuencia de numeración.
-- 2. RPCs transaccionales (mismo patrón que 0012): supabase-js no ofrece
--    transacciones, así que pedido/factura/pago/nota corren en una sola
--    transacción para no dejar el ledger de stock inconsistente.
-- 3. Guard de bloqueo: no se permite factura a crédito a un cliente `bloqueado`
--    (regla dura, solo un admin desbloqueando en 02-clientes la habilita).
-- 4. Se retira la política de `update` abierta sobre `facturas` (0001) para que
--    `pagado_usd`/`estado` solo cambien por la RPC de pago (igual que `compras`).
--
-- La lógica de negocio (subtotal/IVA/total, costo promedio por producto, signo
-- y costo de cada movimiento, ganancia cambiaria) la calculan los servicios en
-- TypeScript; las funciones solo insertan lo recibido y protegen invariantes que
-- no se pueden garantizar desde el cliente (bloqueo de cliente, sobrepago,
-- devolución que excede lo facturado, concurrencia).

-- ============ SECUENCIA DE NOTAS DE CRÉDITO ============
create sequence if not exists public.notas_credito_numero_seq;

-- ============ TABLAS ============
create table public.notas_credito (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null default nextval('public.notas_credito_numero_seq'),
  factura_id uuid not null references public.facturas(id),
  fecha date not null default current_date,
  motivo text not null,
  subtotal_usd numeric(14,6) not null default 0,
  iva_usd numeric(14,6) not null default 0,
  total_usd numeric(14,6) not null default 0,
  estado text not null default 'emitida' check (estado in ('emitida', 'anulada')),
  created_at timestamptz not null default now(),
  unique (numero)
);

create table public.nota_credito_items (
  id uuid primary key default gen_random_uuid(),
  nota_credito_id uuid not null references public.notas_credito(id) on delete cascade,
  factura_item_id uuid not null references public.factura_items(id),
  peso_kg numeric(12,3) not null check (peso_kg > 0),
  precio_usd_kg numeric(14,6) not null check (precio_usd_kg >= 0),
  afecta_inventario boolean not null default false
);

create index if not exists idx_facturas_cliente_estado on public.facturas (cliente_id, estado);
create index if not exists idx_factura_items_factura on public.factura_items (factura_id);
create index if not exists idx_pagos_factura on public.pagos (factura_id);
create index if not exists idx_notas_credito_factura on public.notas_credito (factura_id);
create index if not exists idx_nota_credito_items_nota on public.nota_credito_items (nota_credito_id);
create index if not exists idx_nota_credito_items_factura_item on public.nota_credito_items (factura_item_id);
create index if not exists idx_pedidos_cliente_estado on public.pedidos (cliente_id, estado);
create index if not exists idx_pedido_items_pedido on public.pedido_items (pedido_id);

-- ============ RLS ============
alter table public.notas_credito enable row level security;
alter table public.nota_credito_items enable row level security;

-- Las escrituras de estas tablas pasan por RPC `security definer` (más abajo),
-- por lo que no se necesitan políticas de insert/update. Solo lectura.
create policy "notas_credito_read" on public.notas_credito
  for select to authenticated using (true);

create policy "nota_credito_items_read" on public.nota_credito_items
  for select to authenticated using (true);

-- Retira el update abierto sobre facturas: `pagado_usd`/`estado` solo cambian
-- vía `registrar_pago` (definer). Reemplaza la política `update_all` de 0001.
drop policy if exists "update_all" on public.facturas;

-- ============ GUARD: factura a crédito con cliente bloqueado ============
create or replace function public.facturas_guard_cliente_bloqueado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.condicion = 'credito' and exists (
    select 1 from public.clientes c where c.id = new.cliente_id and c.bloqueado
  ) then
    raise exception 'El cliente está bloqueado: no se permiten ventas a crédito'
      using errcode = 'P0001', hint = 'cliente_bloqueado';
  end if;
  return new;
end;
$$;

drop trigger if exists facturas_guard_cliente_bloqueado on public.facturas;
create trigger facturas_guard_cliente_bloqueado
  before insert on public.facturas
  for each row execute function public.facturas_guard_cliente_bloqueado();

-- ============ registrar_pedido ============
-- security invoker: respeta las políticas de insert existentes (0001).
-- p_pedido: { id, cliente_id, fecha, fecha_entrega, estado, notas }
-- p_items: [{ producto_id, peso_estimado_kg, precio_usd_kg }]
create or replace function public.registrar_pedido(
  p_pedido jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (p_pedido ->> 'id')::uuid;
begin
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'El pedido debe tener al menos un item' using errcode = '23514';
  end if;

  insert into public.pedidos (
    id, cliente_id, fecha, fecha_entrega, estado, notas
  ) values (
    v_id,
    (p_pedido ->> 'cliente_id')::uuid,
    coalesce((p_pedido ->> 'fecha')::date, current_date),
    nullif(p_pedido ->> 'fecha_entrega', '')::date,
    coalesce(p_pedido ->> 'estado', 'pendiente'),
    nullif(p_pedido ->> 'notas', '')
  );

  insert into public.pedido_items (pedido_id, producto_id, peso_estimado_kg, precio_usd_kg)
  select v_id, i.producto_id, i.peso_estimado_kg, i.precio_usd_kg
  from jsonb_to_recordset(p_items)
    as i(producto_id uuid, peso_estimado_kg numeric, precio_usd_kg numeric);

  return v_id;
end;
$$;

revoke all on function public.registrar_pedido(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_pedido(jsonb, jsonb) to authenticated;

-- ============ registrar_factura ============
-- security invoker: respeta las políticas de insert (0001). `numero` se llena
-- con la secuencia (0013), no lo envía el cliente.
-- p_factura: { id, cliente_id, fecha, condicion, tasa_snapshot, iva_pct,
--              subtotal_usd, iva_usd, total_usd, pagado_usd, estado }
-- p_items: [{ producto_id, peso_kg, precio_usd_kg, costo_usd_kg }]
-- p_movimientos: [{ producto_id, tipo, peso_kg, costo_usd_kg, ref_id }]
-- p_pedido_id: si es la entrega de un pedido, su id (opcional).
-- p_pesos_reales: [{ pedido_item_id, peso_kg }] (opcional).
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
    subtotal_usd, iva_usd, total_usd, pagado_usd, estado
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
    p_factura ->> 'estado'
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
-- Solo admin. security definer: `facturas` ya no tiene política de update para
-- authenticated (retirada arriba). Bloquea la fila de la factura (for update)
-- para que dos abonos simultáneos no sobrepasen el saldo.
-- p_pago: { factura_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo,
--           ganancia_cambiaria_bs }
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
    factura_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo, ganancia_cambiaria_bs
  ) values (
    v_factura.id,
    coalesce((p_pago ->> 'fecha')::date, current_date),
    least(v_monto, v_saldo),
    p_pago ->> 'moneda_pago',
    (p_pago ->> 'tasa_pago')::numeric,
    p_pago ->> 'metodo',
    coalesce((p_pago ->> 'ganancia_cambiaria_bs')::numeric, 0)
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

-- ============ registrar_nota_credito ============
-- Solo admin. security definer: el costo de la venta original (costo_usd_kg de
-- `factura_items`) es una columna sensible y aquí se usa para reconstruir el
-- movimiento de ajuste al costo original (no al costo promedio actual).
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
  v_disponible numeric;
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
    where fi.id = v_item.factura_item_id;

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

  insert into public.nota_credito_items (
    nota_credito_id, factura_item_id, peso_kg, precio_usd_kg, afecta_inventario
  )
  select v_id, i.factura_item_id, i.peso_kg, i.precio_usd_kg, coalesce(i.afecta_inventario, false)
  from jsonb_to_recordset(p_items)
    as i(factura_item_id uuid, peso_kg numeric, precio_usd_kg numeric, afecta_inventario boolean);

  -- Devolución a stock vendible: movimiento de ajuste positivo al costo
  -- original de la venta (snapshot), nunca al costo promedio actual.
  insert into public.movimientos (producto_id, tipo, peso_kg, costo_usd_kg, ref_id)
  select fi.producto_id, 'ajuste', i.peso_kg, fi.costo_usd_kg, v_id
  from jsonb_to_recordset(p_items)
    as i(factura_item_id uuid, peso_kg numeric, precio_usd_kg numeric, afecta_inventario boolean)
  join public.factura_items fi on fi.id = i.factura_item_id
  where coalesce(i.afecta_inventario, false);

  return v_id;
end;
$$;

revoke all on function public.registrar_nota_credito(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_nota_credito(jsonb, jsonb) to authenticated;

-- ============ anular_nota_credito ============
-- Solo admin. Revierte el efecto en inventario (movimiento inverso para los
-- items que devolvieron stock) y pasa el estado a 'anulada'. La factura
-- original y los items de la nota nunca se borran ni editan.
create or replace function public.anular_nota_credito(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nota public.notas_credito%rowtype;
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

  -- Revierte el ingreso a stock: movimiento de ajuste negativo por cada item
  -- que había devuelto stock, al mismo costo original.
  insert into public.movimientos (producto_id, tipo, peso_kg, costo_usd_kg, ref_id)
  select fi.producto_id, 'ajuste', -nci.peso_kg, fi.costo_usd_kg, p_id
  from public.nota_credito_items nci
  join public.factura_items fi on fi.id = nci.factura_item_id
  where nci.nota_credito_id = p_id
    and nci.afecta_inventario;
end;
$$;

revoke all on function public.anular_nota_credito(uuid) from public, anon;
grant execute on function public.anular_nota_credito(uuid) to authenticated;
