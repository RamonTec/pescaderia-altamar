-- Migration 018: tasas multi-moneda y escritura solo admin (08-tasas).
--
-- `bs_por_usd` → `valor_bs`: con el euro (solo referencia) el nombre viejo
-- sería engañoso; el valor pasa a ser Bs por 1 unidad de `moneda`. `origen`
-- registra cómo se obtuvo (bcv_scraping / dolarapi / manual), y
-- `registrada_por` / `publicada_en` dan trazabilidad.
--
-- `fecha` pasa a significar **fecha valor** (la fecha que rige la tasa, no la
-- de consulta): el BCV publica por la tarde la tasa del día hábil siguiente,
-- así la tasa vigente de un fin de semana es la última publicada (ver
-- `tasa_vigente`).
--
-- RLS: la escritura abierta de 0001 (`write_all`/`update_all`) permitía que
-- cualquier usuario modificara la tasa de un día pasado (hallazgo 4 del
-- spec). Ahora insert/update solo admin; las tasas automáticas las escribe
-- el servidor con service_role, nunca desde el navegador. La lectura
-- `read_all` de 0001 se conserva.

-- ============ COLUMNAS ============
alter table public.tasas rename column bs_por_usd to valor_bs;
alter table public.tasas rename constraint tasas_bs_por_usd_check to tasas_valor_bs_check;

alter table public.tasas
  add column moneda text not null default 'USD' check (moneda in ('USD', 'EUR')),
  add column origen text check (origen in ('bcv_scraping', 'dolarapi', 'manual')),
  add column registrada_por uuid references public.perfiles(id),
  add column publicada_en timestamptz;

-- Backfill: lo existente es todo USD; lo manual queda manual y el resto vino
-- de dolarapi (el rateService actual solo consulta dolarapi).
update public.tasas
set origen = case when fuente = 'manual' then 'manual' else 'dolarapi' end
where origen is null;

alter table public.tasas alter column origen set not null;

-- ============ UNIQUE E ÍNDICE ============
-- El unique (fecha, fuente) de 0001 no distingue moneda: una EUR del mismo
-- día chocaría con la USD. Se reemplaza por (fecha, fuente, moneda).
alter table public.tasas drop constraint tasas_fecha_fuente_key;
alter table public.tasas
  add constraint tasas_fecha_fuente_moneda_key unique (fecha, fuente, moneda);

drop index if exists public.idx_tasas_fecha;
create index idx_tasas_fuente_moneda_fecha on public.tasas (fuente, moneda, fecha desc);

-- ============ RLS ============
-- Reemplaza las políticas `write_all`/`update_all` de 0001 (mismo patrón que
-- `config_negocio` en 0011).
drop policy if exists "write_all" on public.tasas;
drop policy if exists "update_all" on public.tasas;

create policy "tasas_insert_admin" on public.tasas
  for insert to authenticated with check (public.es_admin());

create policy "tasas_update_admin" on public.tasas
  for update to authenticated using (public.es_admin());

-- ============ tasa_vigente ============
-- Tasa vigente para una fecha: la de mayor fecha ≤ p_fecha para esa fuente y
-- moneda (fin de semana o feriado arrastra la última publicada). Una manual
-- del día corrige la referencial de esa misma fecha, por lo que se prefiere
-- sobre la de la fuente cuando ambas existen en la misma fecha.
create or replace function public.tasa_vigente(
  p_fecha date,
  p_fuente text,
  p_moneda text default 'USD'
)
returns public.tasas
language sql
stable
set search_path = public
as $$
  select t.*
  from public.tasas t
  where t.fuente in (p_fuente, 'manual')
    and t.moneda = p_moneda
    and t.fecha <= p_fecha
  order by t.fecha desc, (t.fuente = 'manual') desc
  limit 1
$$;

revoke all on function public.tasa_vigente(date, text, text) from public, anon;
grant execute on function public.tasa_vigente(date, text, text) to authenticated;
