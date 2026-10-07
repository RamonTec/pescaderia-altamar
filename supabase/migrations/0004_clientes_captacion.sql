-- Migration 004: captación de información de clientes (KYC/antifraude)
-- Extiende public.clientes con datos de persona natural/jurídica, crédito y bloqueo.
-- No modifica datos existentes: los clientes semilla quedan tipo_persona='natural',
-- resto de columnas nuevas en null/false.

alter table public.clientes
  add column tipo_persona text not null default 'natural'
    check (tipo_persona in ('natural', 'juridica')),
  add column email text,
  add column direccion text,
  add column limite_credito_usd numeric(14,6)
    check (limite_credito_usd is null or limite_credito_usd >= 0),
  add column bloqueado boolean not null default false,
  add column motivo_bloqueo text;
