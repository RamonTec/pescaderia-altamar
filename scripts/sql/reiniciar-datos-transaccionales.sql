-- Reinicio de datos transaccionales de prueba antes de cargar el inventario
-- de apertura de octubre 2026 (scripts/importar-inventario-octubre.ts).
--
-- ⚠ BORRADO IRREVERSIBLE. Ejecutar UNA vez en el SQL Editor de Supabase,
-- solo si la base no tiene datos reales. No es una migración a propósito:
-- no debe correr en entornos nuevos.
--
-- Amplía 20261007180000_lotes_reinicio_datos_prueba.sql con las tablas que
-- llegaron después (lotes, contratos). Se CONSERVAN: usuarios y perfiles,
-- clientes, proveedores (con representantes, métodos de pago y documentos),
-- productos, tasas y config_negocio.
--
-- Los PDF de contratos quedan huérfanos en el bucket `contratos` (Supabase
-- no permite borrar storage.objects por SQL): borrarlos desde Storage.

begin;

delete from public.contratos;

delete from public.nota_credito_item_lotes;
delete from public.nota_credito_items;
delete from public.notas_credito;

delete from public.recordatorio_facturas;
delete from public.recordatorios_cobro;

delete from public.pagos;
delete from public.factura_item_lotes;
delete from public.factura_items;
delete from public.facturas;

delete from public.pedido_items;
delete from public.pedidos;

delete from public.perdidas_lote;
delete from public.movimientos;

-- lotes ↔ proceso_items se referencian en ambos sentidos: primero los lotes
-- procesados (apuntan a proceso_items), luego proceso_items (apuntan al lote
-- de origen), luego el resto de lotes.
delete from public.lotes where origen = 'proceso';
delete from public.proceso_items;
delete from public.procesamientos;
delete from public.lotes;

delete from public.pagos_proveedores;
delete from public.compra_items;
delete from public.compras;

-- Próximo número: 1 (is_called = false).
select setval('public.facturas_numero_seq', 1, false);
select setval('public.notas_credito_numero_seq', 1, false);
select setval(pg_get_serial_sequence('public.contratos', 'numero'), 1, false);

commit;
