-- Migration 001: schema inicial pescadería MVP
-- Ejecutar en Supabase SQL Editor o via `supabase db push`

create extension if not exists "pgcrypto";

-- ============ TASAS ============
create table public.tasas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  fuente text not null check (fuente in ('bcv', 'paralela', 'manual')),
  bs_por_usd numeric(14,6) not null check (bs_por_usd > 0),
  created_at timestamptz not null default now(),
  unique (fecha, fuente)
);
create index idx_tasas_fecha on public.tasas (fecha desc);

-- ============ PRODUCTOS ============
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  tipo text not null check (tipo in ('crudo', 'procesado')),
  categoria text,
  controla_stock boolean not null default true,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ CLIENTES / PROVEEDORES ============
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rif_ci text,
  telefono text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rif_ci text,
  telefono text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ COMPRAS (recepción) ============
create table public.compras (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores(id),
  fecha date not null default current_date,
  condicion text not null check (condicion in ('contado', 'credito')),
  moneda text not null check (moneda in ('usd', 'bs')),
  tasa_snapshot numeric(14,6) not null check (tasa_snapshot > 0),
  subtotal_usd numeric(14,6) not null default 0,
  pagado_usd numeric(14,6) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'pagada', 'anulada')),
  notas text,
  created_at timestamptz not null default now()
);

create table public.compra_items (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  peso_kg numeric(12,3) not null check (peso_kg > 0),
  costo_usd_kg numeric(14,6) not null check (costo_usd_kg >= 0)
);

create table public.pagos_proveedores (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id),
  fecha date not null default current_date,
  monto_usd numeric(14,6) not null check (monto_usd > 0),
  moneda_pago text not null check (moneda_pago in ('usd', 'bs')),
  tasa_pago numeric(14,6) not null check (tasa_pago > 0),
  metodo text not null check (metodo in ('efectivo_usd', 'efectivo_bs', 'pago_movil', 'zelle', 'transferencia', 'punto')),
  ganancia_cambiaria_bs numeric(14,6) not null default 0,
  created_at timestamptz not null default now()
);

-- ============ PROCESAMIENTO (limpieza) ============
create table public.procesamientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

create table public.proceso_items (
  id uuid primary key default gen_random_uuid(),
  procesamiento_id uuid not null references public.procesamientos(id) on delete cascade,
  producto_origen_id uuid not null references public.productos(id),
  peso_entrada_kg numeric(12,3) not null check (peso_entrada_kg > 0),
  producto_destino_id uuid not null references public.productos(id),
  peso_salida_kg numeric(12,3) not null check (peso_salida_kg > 0),
  costo_total_usd numeric(14,6) not null check (costo_total_usd >= 0),
  constraint salida_menor_entrada check (peso_salida_kg <= peso_entrada_kg)
);

-- ============ PEDIDOS ============
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  fecha date not null default current_date,
  fecha_entrega date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'entregado', 'facturado', 'anulado')),
  notas text,
  created_at timestamptz not null default now()
);

create table public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  peso_estimado_kg numeric(12,3) not null check (peso_estimado_kg > 0),
  peso_entregado_kg numeric(12,3),
  precio_usd_kg numeric(14,6) not null check (precio_usd_kg >= 0)
);

-- ============ FACTURAS (internas) ============
create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null,
  cliente_id uuid not null references public.clientes(id),
  pedido_id uuid references public.pedidos(id),
  fecha date not null default current_date,
  condicion text not null check (condicion in ('contado', 'credito')),
  tasa_snapshot numeric(14,6) not null check (tasa_snapshot > 0),
  iva_pct numeric(5,2) not null default 16,
  subtotal_usd numeric(14,6) not null default 0,
  iva_usd numeric(14,6) not null default 0,
  total_usd numeric(14,6) not null default 0,
  pagado_usd numeric(14,6) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'pagada', 'anulada')),
  created_at timestamptz not null default now(),
  unique (numero)
);

create table public.factura_items (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  peso_kg numeric(12,3) not null check (peso_kg > 0),
  precio_usd_kg numeric(14,6) not null check (precio_usd_kg >= 0),
  costo_usd_kg numeric(14,6) not null default 0  -- snapshot COGS
);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id),
  fecha date not null default current_date,
  monto_usd numeric(14,6) not null check (monto_usd > 0),
  moneda_pago text not null check (moneda_pago in ('usd', 'bs')),
  tasa_pago numeric(14,6) not null check (tasa_pago > 0),
  metodo text not null check (metodo in ('efectivo_usd', 'efectivo_bs', 'pago_movil', 'zelle', 'transferencia', 'punto')),
  ganancia_cambiaria_bs numeric(14,6) not null default 0,
  created_at timestamptz not null default now()
);

-- ============ LEDGER DE MOVIMIENTOS (auditoría de stock) ============
create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id),
  fecha timestamptz not null default now(),
  tipo text not null check (tipo in ('compra', 'proceso_in', 'proceso_out', 'venta', 'ajuste')),
  peso_kg numeric(12,3) not null,
  costo_usd_kg numeric(14,6) not null default 0,
  ref_id uuid,  -- id de compra/proceso/factura relacionada
  created_at timestamptz not null default now()
);
create index idx_movimientos_producto on public.movimientos (producto_id, created_at desc);

-- ============ RLS ============
alter table public.tasas enable row level security;
alter table public.productos enable row level security;
alter table public.clientes enable row level security;
alter table public.proveedores enable row level security;
alter table public.compras enable row level security;
alter table public.compra_items enable row level security;
alter table public.pagos_proveedores enable row level security;
alter table public.procesamientos enable row level security;
alter table public.proceso_items enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.facturas enable row level security;
alter table public.factura_items enable row level security;
alter table public.pagos enable row level security;
alter table public.movimientos enable row level security;

-- authenticated puede leer todo; escrituras restringidas (refinar en implementación de Auth)
create policy "read_all" on public.tasas for select to authenticated using (true);
create policy "write_all" on public.tasas for insert to authenticated with check (true);
create policy "update_all" on public.tasas for update to authenticated using (true);
create policy "read_all" on public.productos for select to authenticated using (true);
create policy "write_all" on public.productos for insert to authenticated with check (true);
create policy "update_all" on public.productos for update to authenticated using (true);
create policy "delete_all" on public.productos for delete to authenticated using (true);
create policy "read_all" on public.clientes for select to authenticated using (true);
create policy "write_all" on public.clientes for insert to authenticated with check (true);
create policy "update_all" on public.clientes for update to authenticated using (true);
create policy "delete_all" on public.clientes for delete to authenticated using (true);
create policy "read_all" on public.proveedores for select to authenticated using (true);
create policy "write_all" on public.proveedores for insert to authenticated with check (true);
create policy "update_all" on public.proveedores for update to authenticated using (true);
create policy "delete_all" on public.proveedores for delete to authenticated using (true);
create policy "read_all" on public.compras for select to authenticated using (true);
create policy "write_all" on public.compras for insert to authenticated with check (true);
create policy "read_all" on public.compra_items for select to authenticated using (true);
create policy "write_all" on public.compra_items for insert to authenticated with check (true);
create policy "read_all" on public.pagos_proveedores for select to authenticated using (true);
create policy "write_all" on public.pagos_proveedores for insert to authenticated with check (true);
create policy "read_all" on public.procesamientos for select to authenticated using (true);
create policy "write_all" on public.procesamientos for insert to authenticated with check (true);
create policy "read_all" on public.proceso_items for select to authenticated using (true);
create policy "write_all" on public.proceso_items for insert to authenticated with check (true);
create policy "read_all" on public.pedidos for select to authenticated using (true);
create policy "write_all" on public.pedidos for insert to authenticated with check (true);
create policy "update_all" on public.pedidos for update to authenticated using (true);
create policy "read_all" on public.pedido_items for select to authenticated using (true);
create policy "write_all" on public.pedido_items for insert to authenticated with check (true);
create policy "update_all" on public.pedido_items for update to authenticated using (true);
create policy "read_all" on public.facturas for select to authenticated using (true);
create policy "write_all" on public.facturas for insert to authenticated with check (true);
create policy "update_all" on public.facturas for update to authenticated using (true);
create policy "read_all" on public.factura_items for select to authenticated using (true);
create policy "write_all" on public.factura_items for insert to authenticated with check (true);
create policy "read_all" on public.pagos for select to authenticated using (true);
create policy "write_all" on public.pagos for insert to authenticated with check (true);
create policy "read_all" on public.movimientos for select to authenticated using (true);
create policy "write_all" on public.movimientos for insert to authenticated with check (true);

-- ============ SEED (demo) ============
insert into public.tasas (fecha, fuente, bs_por_usd) values
  (current_date, 'bcv', 36.500000),
  (current_date, 'paralela', 39.200000);

insert into public.productos (codigo, nombre, tipo, categoria) values
  ('CUR-001', 'Corocoro entero', 'crudo', 'pescado'),
  ('CUR-002', 'Cachama entera', 'crudo', 'pescado'),
  ('CUR-003', 'Camaron entero', 'crudo', 'marisco'),
  ('PRO-001', 'Filete de corocoro', 'procesado', 'pescado'),
  ('PRO-002', 'Filete de cachama', 'procesado', 'pescado'),
  ('PRO-003', 'Camaron limpio', 'procesado', 'marisco');

insert into public.clientes (nombre, rif_ci, telefono) values
  ('Restaurante El Muelle', 'J-12345678-9', '0412-1234567'),
  ('Doña María (contado)', 'V-9876543-2', '0414-7654321');

insert into public.proveedores (nombre, rif_ci, telefono) values
  ('Pesquera La Espiga', 'J-40111222-3', '0424-5556667'),
  ('Cooperativa Lago', 'J-40333444-5', '0416-7778889');
