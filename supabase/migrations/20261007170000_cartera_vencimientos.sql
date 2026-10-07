-- 09-cuentas-por-cobrar (1/3): vencimiento de facturas y días de crédito.
--
-- - config_negocio: días de crédito por defecto, días de aviso "por vencer",
--   datos del negocio para los recordatorios de cobro.
-- - clientes.dias_credito: días habituales del cliente (null = el default).
-- - facturas.dias_credito + facturas.fecha_vencimiento: snapshot de los días
--   otorgados en esa factura; `fecha_vencimiento = fecha + dias_credito`
--   garantizado por check y derivado por trigger (nunca lo envía el cliente).
-- - registrar_factura: recibe `dias_credito` (contado = 0).
--
-- Supone aplicadas 0018/0019 (08-tasas): la nueva versión de
-- `registrar_factura` conserva las columnas de procedencia de la tasa
-- (`tasa_origen`, `tasa_fuente`, `tasa_referencial`). 07-lotes todavía no
-- reescribió la función; quien la toque después debe conservar
-- `dias_credito` (ver specs/09-cuentas-por-cobrar/tasks.md).

-- ============ config_negocio ============
alter table public.config_negocio
  add column if not exists dias_credito_default int not null default 15
    check (dias_credito_default between 0 and 365),
  add column if not exists dias_aviso_por_vencer int not null default 3
    check (dias_aviso_por_vencer between 0 and 60),
  add column if not exists instrucciones_pago text,
  add column if not exists nombre_comercial text default 'Altamar Sea Food',
  add column if not exists email_respuesta text;

-- ============ clientes ============
alter table public.clientes
  add column if not exists dias_credito int
    check (dias_credito is null or dias_credito between 0 and 365);

-- ============ facturas ============
alter table public.facturas
  add column if not exists dias_credito int not null default 0
    check (dias_credito between 0 and 365),
  add column if not exists fecha_vencimiento date;

-- Facturas existentes (de prueba; 07-lotes las vacía): 0 días, vencen el
-- mismo día de emisión.
update public.facturas
set fecha_vencimiento = fecha + dias_credito
where fecha_vencimiento is null;

alter table public.facturas
  alter column fecha_vencimiento set not null;

alter table public.facturas
  drop constraint if exists facturas_fecha_vencimiento_check;
alter table public.facturas
  add constraint facturas_fecha_vencimiento_check
    check (fecha_vencimiento = fecha + dias_credito);

-- Derivación: cualquier insert (RPC actual o futura) obtiene el vencimiento
-- correcto sin tener que calcularlo; un valor enviado se ignora.
create or replace function public.facturas_derivar_vencimiento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.dias_credito := coalesce(new.dias_credito, 0);
  new.fecha_vencimiento := new.fecha + new.dias_credito;
  return new;
end;
$$;

drop trigger if exists facturas_derivar_vencimiento on public.facturas;
create trigger facturas_derivar_vencimiento
  before insert or update of fecha, dias_credito, fecha_vencimiento on public.facturas
  for each row execute function public.facturas_derivar_vencimiento();

create index if not exists idx_facturas_cliente_estado_vencimiento
  on public.facturas (cliente_id, estado, fecha_vencimiento);

-- ============ registrar_factura ============
-- Igual que 0019 (security invoker; procedencia de tasa de 08-tasas) más
-- `dias_credito`: contado fuerza 0; crédito usa el valor recibido (0–365,
-- lo valida el check). `fecha_vencimiento` la deriva el trigger.
-- p_factura: { id, cliente_id, fecha, condicion, dias_credito, tasa_snapshot,
--              iva_pct, subtotal_usd, iva_usd, total_usd, pagado_usd, estado,
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
