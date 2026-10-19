-- 16-procesamiento-multisalida (1/3): esquema.
--
-- Un procesamiento = un lote crudo + un peso de entrada → N salidas
-- (decisión del 2026-10-19, reemplaza "un lote crudo da un lote procesado"
-- de 07-lotes y la transferencia total del costo de /SPEC.md §4.3).
--
-- Opción C de la spec ("cabecera + líneas prorrateadas"):
--   - `procesamientos` guarda la entrada única (fuente de verdad):
--     lote, peso, costo total y método de reparto.
--   - Cada `proceso_items` sigue siendo una salida y guarda su parte
--     prorrateada de la entrada (por kg) y su costo asignado (por valor de
--     venta). Σ líneas = cabecera: las RPC del dashboard y `resultadoLote`
--     siguen cuadrando sin cambios.
--   - `productos.precio_referencia_usd_kg`: precio de venta de referencia de
--     un procesado (no es costo). `proceso_items.precio_referencia_usd_kg`
--     es el snapshot del precio usado en el reparto.

-- ============ productos ============
alter table public.productos
  add column if not exists precio_referencia_usd_kg numeric(14,6);

alter table public.productos
  add constraint productos_precio_referencia_no_negativo
  check (precio_referencia_usd_kg is null or precio_referencia_usd_kg >= 0);

alter table public.productos
  add constraint productos_precio_referencia_solo_procesado
  check (tipo = 'procesado' or precio_referencia_usd_kg is null);

comment on column public.productos.precio_referencia_usd_kg is
  'Precio de venta de referencia USD/kg de un procesado: reparte el costo de un procesamiento con varias salidas (16). No es un costo.';

-- ============ procesamientos (cabecera) ============
alter table public.procesamientos
  add column if not exists lote_origen_id uuid references public.lotes(id),
  add column if not exists peso_entrada_kg numeric(12,3),
  add column if not exists costo_total_usd numeric(14,6),
  add column if not exists reparto_costo text;

alter table public.procesamientos
  add constraint procesamientos_peso_entrada_positivo
  check (peso_entrada_kg is null or peso_entrada_kg > 0);

alter table public.procesamientos
  add constraint procesamientos_costo_total_no_negativo
  check (costo_total_usd is null or costo_total_usd >= 0);

alter table public.procesamientos
  add constraint procesamientos_reparto_costo_check
  check (reparto_costo is null or reparto_costo in ('valor', 'peso'));

create index if not exists idx_procesamientos_lote_origen
  on public.procesamientos (lote_origen_id);

-- ============ proceso_items ============
alter table public.proceso_items
  add column if not exists precio_referencia_usd_kg numeric(14,6);

alter table public.proceso_items
  add constraint proceso_items_precio_referencia_no_negativo
  check (precio_referencia_usd_kg is null or precio_referencia_usd_kg >= 0);

-- Una salida por producto en cada procesamiento.
create unique index if not exists uq_proceso_items_procesamiento_destino
  on public.proceso_items (procesamiento_id, producto_destino_id);

-- ============ Relleno de la cabecera ============
-- Cada procesamiento histórico tiene una línea con su lote (la UI mandaba
-- una sola). Si todas sus líneas comparten un lote, la cabecera = ese lote,
-- Σ entrada y Σ costo; el costo pasó completo (equivale al reparto por peso).
update public.procesamientos pr
set
  lote_origen_id = agg.lote_origen_id,
  peso_entrada_kg = agg.peso_entrada_kg,
  costo_total_usd = agg.costo_total_usd,
  reparto_costo = 'peso'
from (
  select
    pi.procesamiento_id,
    min(pi.lote_origen_id::text)::uuid as lote_origen_id,
    sum(pi.peso_entrada_kg) as peso_entrada_kg,
    sum(pi.costo_total_usd) as costo_total_usd
  from public.proceso_items pi
  group by pi.procesamiento_id
  having count(distinct pi.lote_origen_id) = 1
) agg
where agg.procesamiento_id = pr.id
  and pr.lote_origen_id is null;

-- Filas nuevas: las cuatro columnas obligatorias (las escribe la RPC).
alter table public.procesamientos
  add constraint procesamientos_cabecera_completa
  check (
    lote_origen_id is not null
    and peso_entrada_kg is not null
    and costo_total_usd is not null
    and reparto_costo is not null
  ) not valid;

-- Se valida si no quedó ninguna fila legada sin cabecera (procesamientos con
-- líneas de lotes distintos o sin líneas). Si quedan, el check sigue
-- `not valid` (exigido solo a filas nuevas) y se deja constancia.
do $$
declare
  v_legadas int;
begin
  select count(*) into v_legadas
  from public.procesamientos
  where lote_origen_id is null
     or peso_entrada_kg is null
     or costo_total_usd is null
     or reparto_costo is null;

  if v_legadas = 0 then
    alter table public.procesamientos validate constraint procesamientos_cabecera_completa;
  else
    raise notice '16-procesamiento-multisalida: % procesamiento(s) legado(s) sin cabecera; procesamientos_cabecera_completa queda NOT VALID', v_legadas;
    execute format(
      'comment on constraint procesamientos_cabecera_completa on public.procesamientos is %L',
      format('NOT VALID: %s procesamiento(s) legado(s) sin cabecera al aplicar 20261019000000', v_legadas)
    );
  end if;
end;
$$;

comment on column public.procesamientos.reparto_costo is
  'Cómo se repartió el costo entre las salidas: valor (kg × precio de referencia) o peso (una sola salida o todos los precios en 0).';
comment on column public.proceso_items.peso_entrada_kg is
  'Parte prorrateada (por kg de salida) de la entrada de la cabecera; Σ = procesamientos.peso_entrada_kg. Dato técnico: la UI no muestra merma por salida.';
comment on column public.proceso_items.costo_total_usd is
  'Costo asignado a esta salida; Σ = procesamientos.costo_total_usd.';
comment on column public.proceso_items.precio_referencia_usd_kg is
  'Snapshot del precio de referencia usado en el reparto (null en filas históricas o con una sola salida sin precio).';
