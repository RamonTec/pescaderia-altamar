-- Migration 017: corrige `stock_y_costo_producto` (0013).
--
-- El parámetro de salida `costo_usd_kg` se llama igual que la columna de
-- `movimientos`; PL/pgSQL rechazaba la consulta con 42702 ("column reference
-- costo_usd_kg is ambiguous") y todo `registrar_procesamiento` fallaba.
-- Se califican las columnas con el alias de la tabla. Misma lógica.

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
    select mv.peso_kg, mv.costo_usd_kg as costo
    from public.movimientos mv
    where mv.producto_id = p_producto_id
    order by mv.created_at, mv.id
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
