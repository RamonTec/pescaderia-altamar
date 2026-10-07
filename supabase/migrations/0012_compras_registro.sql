-- Migration 012: registro atómico de compras y pagos a proveedores (04-inventario).
--
-- Por qué funciones RPC: supabase-js no ofrece transacciones. Una compra son
-- tres escrituras (compras + compra_items + un movimiento por item) y un pago
-- son dos (pagos_proveedores + actualizar compras.pagado_usd/estado). Si una
-- falla a mitad, el ledger de stock queda inconsistente. Cada función corre en
-- una sola transacción.
--
-- La lógica de negocio (subtotal, conversión Bs→USD, signo y costo de cada
-- movimiento, ganancia cambiaria) la calcula `compraService` en TypeScript;
-- estas funciones solo insertan lo recibido y protegen invariantes que no se
-- pueden garantizar desde el cliente (bloqueo de proveedor, sobrepago,
-- concurrencia entre dos abonos a la misma compra).

-- ============ GUARD: compra a crédito con proveedor bloqueado ============
-- Misma regla que valida compraService, repetida en la base para que no se
-- pueda saltar llamando a PostgREST directamente.
create or replace function public.compras_guard_proveedor_bloqueado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.condicion = 'credito' and exists (
    select 1 from public.proveedores p where p.id = new.proveedor_id and p.bloqueado
  ) then
    raise exception 'El proveedor está bloqueado: no se permiten compras a crédito'
      using errcode = 'P0001', hint = 'proveedor_bloqueado';
  end if;
  return new;
end;
$$;

drop trigger if exists compras_guard_proveedor_bloqueado on public.compras;
create trigger compras_guard_proveedor_bloqueado
  before insert on public.compras
  for each row execute function public.compras_guard_proveedor_bloqueado();

-- Consultas de saldo por proveedor (proveedorBalanceService) y listado.
create index if not exists idx_compras_proveedor_estado
  on public.compras (proveedor_id, estado);
create index if not exists idx_compra_items_compra
  on public.compra_items (compra_id);
create index if not exists idx_pagos_proveedores_compra
  on public.pagos_proveedores (compra_id);

-- ============ registrar_compra ============
-- security invoker: respeta las políticas de insert existentes (0001).
-- p_compra: { id, proveedor_id, fecha, condicion, moneda, tasa_snapshot,
--             subtotal_usd, pagado_usd, estado, notas }
-- p_items: [{ producto_id, peso_kg, costo_usd_kg }]
-- p_movimientos: [{ producto_id, tipo, peso_kg, costo_usd_kg, ref_id }]
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
    subtotal_usd, pagado_usd, estado, notas
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
    nullif(p_compra ->> 'notas', '')
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
-- Solo admin. security definer: `compras` no tiene política de update para authenticated
-- (a propósito: pagado_usd/estado solo deben cambiar por esta vía). La función
-- bloquea la fila de la compra (for update) para que dos abonos simultáneos no
-- sobrepasen el saldo.
-- p_pago: { compra_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo,
--           ganancia_cambiaria_bs }
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
    compra_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo, ganancia_cambiaria_bs
  ) values (
    v_compra.id,
    coalesce((p_pago ->> 'fecha')::date, current_date),
    least(v_monto, v_saldo),
    p_pago ->> 'moneda_pago',
    (p_pago ->> 'tasa_pago')::numeric,
    p_pago ->> 'metodo',
    coalesce((p_pago ->> 'ganancia_cambiaria_bs')::numeric, 0)
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
