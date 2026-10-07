-- 09-cuentas-por-cobrar (2/3): recordatorios de cobro (WhatsApp y correo).
--
-- - recordatorios_cobro: un registro por recordatorio. WhatsApp queda
--   `generado` (el sistema abre wa.me; no sabe si el usuario lo envió);
--   correo, `enviado` o `fallido` (Resend).
-- - recordatorio_facturas: qué facturas incluyó cada recordatorio.
-- - recordatorios_cobro_view: lectura para todos; `mensaje` y `asunto` en
--   null si no es admin (patrón de 0003: vista security definer + revoke de
--   la tabla base).
-- - registrar_recordatorio_cobro: alta atómica (recordatorio + facturas),
--   solo admin. Reintentar un correo fallido crea un registro nuevo.

create table if not exists public.recordatorios_cobro (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  canal text not null check (canal in ('whatsapp', 'email')),
  destinatario text not null,
  asunto text,
  mensaje text not null,
  estado text not null check (estado in ('generado', 'enviado', 'fallido')),
  error text,
  proveedor_id_mensaje text,
  enviado_por uuid default auth.uid() references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.recordatorio_facturas (
  recordatorio_id uuid not null references public.recordatorios_cobro(id) on delete cascade,
  factura_id uuid not null references public.facturas(id),
  primary key (recordatorio_id, factura_id)
);

create index if not exists idx_recordatorios_cobro_cliente_fecha
  on public.recordatorios_cobro (cliente_id, created_at desc);
create index if not exists idx_recordatorio_facturas_factura
  on public.recordatorio_facturas (factura_id);

-- ============ RLS ============
alter table public.recordatorios_cobro enable row level security;
alter table public.recordatorio_facturas enable row level security;

create policy "recordatorios_cobro_read" on public.recordatorios_cobro
  for select to authenticated using (true);
create policy "recordatorios_cobro_insert_admin" on public.recordatorios_cobro
  for insert to authenticated with check (public.es_admin());

create policy "recordatorio_facturas_read" on public.recordatorio_facturas
  for select to authenticated using (true);
create policy "recordatorio_facturas_insert_admin" on public.recordatorio_facturas
  for insert to authenticated with check (public.es_admin());

-- El texto del recordatorio (con montos) no se lee de la tabla base: solo
-- por la vista, que lo anula para el operador.
revoke select on public.recordatorios_cobro from authenticated, anon;

-- ============ VISTA ============
create or replace view public.recordatorios_cobro_view
as
select
  r.id,
  r.cliente_id,
  r.canal,
  r.destinatario,
  case when public.es_admin() then r.asunto else null end as asunto,
  case when public.es_admin() then r.mensaje else null end as mensaje,
  r.estado,
  r.error,
  r.proveedor_id_mensaje,
  r.enviado_por,
  p.nombre as enviado_por_nombre,
  r.created_at,
  coalesce(
    (select array_agg(rf.factura_id) from public.recordatorio_facturas rf
     where rf.recordatorio_id = r.id),
    '{}'::uuid[]
  ) as factura_ids
from public.recordatorios_cobro r
left join public.perfiles p on p.id = r.enviado_por;

grant select on public.recordatorios_cobro_view to authenticated;

-- ============ RPC ============
-- security invoker: las políticas `with check (es_admin())` aplican; la
-- verificación explícita da un mensaje legible. Valida que las facturas sean
-- del cliente.
-- p_recordatorio: { id, cliente_id, canal, destinatario, asunto?, mensaje,
--                   estado, error?, proveedor_id_mensaje? }
create or replace function public.registrar_recordatorio_cobro(
  p_recordatorio jsonb,
  p_factura_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := coalesce((p_recordatorio ->> 'id')::uuid, gen_random_uuid());
  v_cliente uuid := (p_recordatorio ->> 'cliente_id')::uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede enviar recordatorios'
      using errcode = '42501';
  end if;

  if coalesce(array_length(p_factura_ids, 1), 0) = 0 then
    raise exception 'El recordatorio debe incluir al menos una factura'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from unnest(p_factura_ids) as x(id)
    where not exists (
      select 1 from public.facturas f where f.id = x.id and f.cliente_id = v_cliente
    )
  ) then
    raise exception 'Alguna factura no pertenece al cliente'
      using errcode = 'P0001';
  end if;

  insert into public.recordatorios_cobro (
    id, cliente_id, canal, destinatario, asunto, mensaje, estado, error,
    proveedor_id_mensaje
  ) values (
    v_id,
    v_cliente,
    p_recordatorio ->> 'canal',
    p_recordatorio ->> 'destinatario',
    nullif(p_recordatorio ->> 'asunto', ''),
    p_recordatorio ->> 'mensaje',
    p_recordatorio ->> 'estado',
    nullif(p_recordatorio ->> 'error', ''),
    nullif(p_recordatorio ->> 'proveedor_id_mensaje', '')
  );

  insert into public.recordatorio_facturas (recordatorio_id, factura_id)
  select v_id, x.id from unnest(p_factura_ids) as x(id)
  on conflict do nothing;

  return v_id;
end;
$$;

revoke all on function public.registrar_recordatorio_cobro(jsonb, uuid[]) from public, anon;
grant execute on function public.registrar_recordatorio_cobro(jsonb, uuid[]) to authenticated;
