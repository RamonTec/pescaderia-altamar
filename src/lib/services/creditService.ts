/**
 * CreditService (SRP): saldos de crédito y ganancia cambiaria.
 * La deuda se pacta en USD con tasa de factura congelada;
 * cada abono en Bs usa la tasa del día del pago.
 *
 * Ganancia cambiaria (Bs) sobre la porción pagada:
 *   (tasa_pago − tasa_factura) × usd_pagados
 */

export function gananciaCambiariaBs(
  tasaFactura: number,
  tasaPago: number,
  usdPagados: number,
  monedaPago: 'usd' | 'bs'
): number {
  if (monedaPago === 'usd') return 0
  return (tasaPago - tasaFactura) * usdPagados
}

export function usdEquivalentes(
  monto: number,
  moneda: 'usd' | 'bs',
  tasa: number
): number {
  return moneda === 'usd' ? monto : tasa > 0 ? monto / tasa : 0
}

export function saldoPendiente(totalUsd: number, pagadoUsd: number): number {
  return Math.round((totalUsd - pagadoUsd) * 1e6) / 1e6
}
