-- Migration 015: numeración secuencial de facturas (05-ventas).
--
-- Hoy `facturas.numero` es `bigint not null` sin default: la responsabilidad de
-- generar el número recae en el código (riesgo de colisión entre dos emisiones
-- simultáneas). Se mueve la numeración a una secuencia Postgres real, que es
-- atómica y no puede repetir números bajo concurrencia.

create sequence if not exists public.facturas_numero_seq;

alter table public.facturas
  alter column numero set default nextval('public.facturas_numero_seq');

-- Sincroniza la secuencia con el máximo número ya existente para no pisar
-- facturas emitidas antes de esta migración.
select setval(
  'public.facturas_numero_seq',
  coalesce((select max(numero) from public.facturas), 0),
  true
);
