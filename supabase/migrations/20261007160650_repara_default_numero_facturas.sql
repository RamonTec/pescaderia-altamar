-- Reparación incremental: garantiza que `facturas.numero` tenga el default
-- de secuencia de 0015 aunque esa migración se haya aplicado de forma parcial
-- o desincronizada en algún entorno (síntoma: INSERT vía RPC
-- `registrar_factura` falla con 23502 "null value in column numero").
--
-- Idempotente: re-ejecuta lo mismo que 0015 sin dañar datos existentes.

create sequence if not exists public.facturas_numero_seq;

alter table public.facturas
  alter column numero set default nextval('public.facturas_numero_seq');

-- Re-sincroniza solo si la secuencia quedó detrás del máximo existente
-- (setval con is_called = true: el próximo nextval devuelve max + 1).
select setval(
  'public.facturas_numero_seq',
  greatest(
    coalesce((select max(numero) from public.facturas), 0),
    (select last_value from public.facturas_numero_seq)
  ),
  true
);