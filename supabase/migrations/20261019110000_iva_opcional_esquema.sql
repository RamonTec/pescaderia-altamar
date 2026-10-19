-- 18-iva-opcional (1/2): esquema.
--
-- Reemplaza "IVA desglosado configurable (default 16 %)" aplicado a toda
-- venta (/SPEC.md §2; decisión del usuario, 2026-10-19): el IVA es sí/no por
-- factura. Sí = config_negocio.iva_pct vigente; no = 0 %. Una factura sin IVA
-- es `facturas.iva_pct = 0` (sin booleano nuevo en `facturas`).
--
-- - clientes.aplica_iva: precarga el interruptor de IVA de cada venta.
-- - factura_correcciones: `tipo linea|iva`; las correcciones de IVA son a
--   nivel factura (sin línea) y guardan el % y los créditos de notas antes y
--   después. El check de 17 se reemplaza por uno por tipo.
-- - facturas_validar_iva (before insert): `registrar_factura` inserta lo que
--   recibe; el trigger exige iva_pct ∈ {0, config} e importes coherentes.
-- - notas_credito_iva_factura (before insert): el IVA de una nota nueva
--   sigue siempre al `iva_pct` vigente de su factura.

-- ============ clientes.aplica_iva ============
alter table public.clientes
  add column if not exists aplica_iva boolean not null default true;

comment on column public.clientes.aplica_iva is
  'Aplica IVA (18). Precarga el interruptor de IVA de cada venta; se puede cambiar solo para esa factura.';

-- ============ factura_correcciones: tipo linea|iva ============
alter table public.factura_correcciones
  add column if not exists tipo text not null default 'linea'
    constraint factura_correcciones_tipo_check check (tipo in ('linea', 'iva')),
  add column if not exists iva_pct_anterior numeric(5,2),
  add column if not exists iva_pct_nuevo numeric(5,2),
  add column if not exists creditos_anterior_usd numeric(14,6),
  add column if not exists creditos_nuevo_usd numeric(14,6);

alter table public.factura_correcciones
  alter column factura_item_id drop not null,
  alter column peso_anterior_kg drop not null,
  alter column peso_nuevo_kg drop not null,
  alter column precio_anterior_usd_kg drop not null,
  alter column precio_nuevo_usd_kg drop not null,
  alter column costo_anterior_usd_kg drop not null,
  alter column costo_nuevo_usd_kg drop not null;

alter table public.factura_correcciones
  drop constraint if exists factura_correcciones_cambio_real;

alter table public.factura_correcciones
  add constraint factura_correcciones_forma check (
    (tipo = 'linea'
       and factura_item_id is not null
       and peso_anterior_kg is not null and peso_nuevo_kg is not null
       and precio_anterior_usd_kg is not null and precio_nuevo_usd_kg is not null
       and costo_anterior_usd_kg is not null and costo_nuevo_usd_kg is not null
       and (peso_nuevo_kg <> peso_anterior_kg or precio_nuevo_usd_kg <> precio_anterior_usd_kg))
    or
    (tipo = 'iva'
       and factura_item_id is null
       and peso_anterior_kg is null and peso_nuevo_kg is null
       and precio_anterior_usd_kg is null and precio_nuevo_usd_kg is null
       and costo_anterior_usd_kg is null and costo_nuevo_usd_kg is null
       and iva_pct_anterior is not null and iva_pct_nuevo is not null
       and (iva_pct_anterior = 0) <> (iva_pct_nuevo = 0)
       and creditos_anterior_usd is not null and creditos_nuevo_usd is not null
       and subtotal_nuevo_usd = subtotal_anterior_usd)
  );

comment on table public.factura_correcciones is
  'Historial de correcciones de facturas (17 y 18): tipo linea = peso y precio/kg de una línea; tipo iva = activar o quitar el IVA de la factura (sin línea). Solo lo lee el admin; solo escriben corregir_linea_factura y cambiar_iva_factura. Permanente.';

comment on column public.factura_correcciones.creditos_anterior_usd is
  'Solo tipo iva: Σ total_usd de las notas de crédito emitidas antes del cambio.';
comment on column public.factura_correcciones.creditos_nuevo_usd is
  'Solo tipo iva: Σ total_usd de las notas de crédito emitidas después del cambio (recalculadas al % nuevo).';

-- ============ facturas_validar_iva ============
create or replace function public.facturas_validar_iva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config numeric;
begin
  select c.iva_pct into v_config from public.config_negocio c where c.id = 1;

  if new.iva_pct is null
     or not (new.iva_pct = 0 or (v_config is not null and new.iva_pct = v_config)) then
    raise exception 'El IVA de la factura debe ser 0 %% o el configurado (% %%)',
      coalesce(v_config, 0)
      using errcode = 'P0001', hint = 'iva_invalido';
  end if;

  if new.subtotal_usd is null or new.iva_usd is null or new.total_usd is null
     or abs(new.iva_usd - round(new.subtotal_usd * new.iva_pct / 100, 6)) > 0.000001
     or abs(new.total_usd - round(new.subtotal_usd + new.iva_usd, 6)) > 0.000001 then
    raise exception 'Los importes de IVA y total de la factura no son coherentes'
      using errcode = 'P0001', hint = 'iva_invalido';
  end if;

  return new;
end;
$$;

revoke all on function public.facturas_validar_iva() from public, anon;

drop trigger if exists facturas_validar_iva on public.facturas;
create trigger facturas_validar_iva
  before insert on public.facturas
  for each row execute function public.facturas_validar_iva();

-- ============ notas_credito_iva_factura ============
-- `registrar_nota_credito` ya tomó el lock de la factura antes del insert: el
-- `iva_pct` leído aquí es el confirmado (cierra la carrera con cambiar_iva_factura).
create or replace function public.notas_credito_iva_factura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_iva_pct numeric;
begin
  select f.iva_pct into v_iva_pct from public.facturas f where f.id = new.factura_id;

  if v_iva_pct is not null then
    new.iva_usd := round(coalesce(new.subtotal_usd, 0) * v_iva_pct / 100, 6);
    new.total_usd := round(coalesce(new.subtotal_usd, 0) + new.iva_usd, 6);
  end if;

  return new;
end;
$$;

revoke all on function public.notas_credito_iva_factura() from public, anon;

drop trigger if exists notas_credito_iva_factura on public.notas_credito;
create trigger notas_credito_iva_factura
  before insert on public.notas_credito
  for each row execute function public.notas_credito_iva_factura();
