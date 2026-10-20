import { usdEquivalentes } from '@/lib/services/creditService'

/**
 * Costo de las líneas de una compra (04, 19). Funciones puras: las usan
 * `compraService` (alta), la vista previa de la edición
 * (`lib/compras/edicion.ts`) y los scripts. Mismo redondeo que la RPC
 * `editar_compra`: `round(x, 6)`.
 */

export const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6
export const redondea3 = (n: number) => Math.round(n * 1e3) / 1e3

/** Costo/kg en USD a partir del costo pactado en la moneda de la compra. */
export function costoUsdKg(costoKg: number, moneda: 'usd' | 'bs', tasa: number): number {
  return redondea6(usdEquivalentes(costoKg, moneda, tasa))
}

/** Total USD de la compra: `round(Σ peso × costo_usd, 6)`. */
export function subtotalUsd(items: readonly { peso_kg: number; costo_usd_kg: number }[]): number {
  return redondea6(items.reduce((s, i) => s + i.peso_kg * i.costo_usd_kg, 0))
}
