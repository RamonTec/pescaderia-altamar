-- Migration 014: de qué crudo se obtiene cada procesado (04-inventario, §4.3).
--
-- Hasta 0013 un procesamiento aceptaba cualquier par crudo → procesado
-- (ej. "Cachama entera → Filete de corocoro"). Cada procesado sale de un solo
-- crudo; un crudo puede tener varios procesados (filete, ruedas, limpio).

alter table public.productos
  add column if not exists producto_origen_id uuid references public.productos(id);

create index if not exists idx_productos_origen on public.productos (producto_origen_id);

-- Un crudo no tiene origen; un procesado debe tenerlo. `not valid`: no
-- rechaza procesados ya existentes sin asignar (se completan en Catálogos),
-- pero sí cualquier alta o edición nueva.
alter table public.productos
  add constraint productos_origen_segun_tipo check (
    (tipo = 'crudo' and producto_origen_id is null)
    or (tipo = 'procesado' and producto_origen_id is not null)
  ) not valid;

-- El origen debe ser un crudo, y un crudo con procesados no puede pasar a
-- procesado (un check no puede mirar otras filas).
create or replace function public.productos_guard_origen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.producto_origen_id is not null then
    if new.producto_origen_id = new.id or not exists (
      select 1 from public.productos c
      where c.id = new.producto_origen_id and c.tipo = 'crudo'
    ) then
      raise exception 'El producto de origen debe ser un crudo'
        using errcode = 'P0001', hint = 'origen_no_crudo';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.tipo = 'crudo' and new.tipo <> 'crudo' and exists (
    select 1 from public.productos d where d.producto_origen_id = new.id
  ) then
    raise exception 'Este crudo tiene procesados asociados: no puede cambiar de tipo'
      using errcode = 'P0001', hint = 'crudo_con_procesados';
  end if;

  return new;
end;
$$;

drop trigger if exists productos_guard_origen on public.productos;
create trigger productos_guard_origen
  before insert or update on public.productos
  for each row execute function public.productos_guard_origen();

-- Productos demo de 0001.
update public.productos p
set producto_origen_id = c.id
from public.productos c
where (p.codigo, c.codigo) in (
  ('PRO-001', 'CUR-001'),
  ('PRO-002', 'CUR-002'),
  ('PRO-003', 'CUR-003')
)
  and p.tipo = 'procesado'
  and c.tipo = 'crudo'
  and p.producto_origen_id is null;

-- ============ registrar_procesamiento (reemplaza la de 0013) ============
-- Única diferencia: el destino debe obtenerse del crudo de origen.
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
    if v_destino.producto_origen_id is distinct from v_origen.id then
      raise exception '% no se obtiene de %', v_destino.nombre, v_origen.nombre
        using errcode = 'P0001', hint = 'destino_no_corresponde';
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
