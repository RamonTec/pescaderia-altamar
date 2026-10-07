-- 07-lotes (1/5): reinicio de los datos transaccionales de prueba.
--
-- ⚠ BORRADO IRREVERSIBLE. Confirmar con el usuario, JUSTO ANTES de aplicar,
-- que no entró ningún dato real desde el 2026-10-07 (spec 07-lotes,
-- "Arranque de datos"). La base solo tiene datos de prueba (confirmado el
-- 2026-10-07): no se migra el stock existente a lotes, se empieza limpio.
--
-- Va ANTES de las migraciones de esquema de lotes: con el ledger vacío, los
-- checks y el `not null` de lote se crean validados desde el inicio.
--
-- Se vacía (en orden de dependencias): notas de crédito, recordatorios de
-- cobro (09: referencian facturas; sin facturas no tienen sentido), pagos,
-- facturas, pedidos, movimientos, procesamientos, pagos a proveedores y
-- compras. Se reinician las secuencias de facturas y notas de crédito.
--
-- Se CONSERVAN: usuarios y perfiles, clientes (representantes, documentos),
-- proveedores (representantes, métodos de pago, documentos), productos,
-- tasas y config_negocio.

delete from public.nota_credito_items;
delete from public.notas_credito;

delete from public.recordatorio_facturas;
delete from public.recordatorios_cobro;

delete from public.pagos;
delete from public.factura_items;
delete from public.facturas;

delete from public.pedido_items;
delete from public.pedidos;

delete from public.movimientos;

delete from public.proceso_items;
delete from public.procesamientos;

delete from public.pagos_proveedores;
delete from public.compra_items;
delete from public.compras;

-- Próximo número: 1 (is_called = false).
select setval('public.facturas_numero_seq', 1, false);
select setval('public.notas_credito_numero_seq', 1, false);
