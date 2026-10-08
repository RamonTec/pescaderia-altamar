-- 06-contratos (1/2): datos del negocio para el encabezado de los contratos.
--
-- Razón social, RIF, dirección y teléfono del negocio. Opcionales en la base
-- (el formulario los deja vacíos), obligatorios para generar un contrato: lo
-- valida `contratoService`. Las RLS de `config_negocio` no cambian (lectura
-- `authenticated`, escritura `es_admin()`): son datos públicos del negocio.

alter table public.config_negocio
  add column if not exists razon_social text
    check (razon_social is null or char_length(razon_social) <= 160),
  add column if not exists rif text
    check (rif is null or rif ~ '^[VEJG]-\d{6,10}(-\d)?$'),
  add column if not exists direccion text
    check (direccion is null or char_length(direccion) <= 300),
  add column if not exists telefono text
    check (telefono is null or char_length(telefono) <= 20);
