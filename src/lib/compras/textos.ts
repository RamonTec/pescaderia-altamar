import type { Compra, Moneda } from '@/types/domain'
import { fechaCorta } from '@/lib/contratos/textos'
import { formatBs, formatTasa, formatUsd } from '@/lib/format'
import { desviacionPct } from '@/lib/tasaValidation'

/** Textos de la ficha y la edición de compras (19). Puro: sin React. */

const FUENTE = { bcv: 'BCV', paralela: 'paralela' } as const

/** «Compra del 07/10/2026». */
export function tituloCompra(fecha: string): string {
  return `Compra del ${fechaCorta(fecha)}`
}

/** Monto en la moneda de la compra: `Bs. 3.500,00` o `$12.00`. */
export function formatMoneda(n: number, moneda: Moneda): string {
  return moneda === 'bs' ? formatBs(n) : formatUsd(n)
}

/** Procedencia de la tasa (08-tasas): «Referencial BCV» o «Manual (referencial BCV 36,50…, +2,1 %)». */
export function textoProcedenciaTasa(
  c: Pick<Compra, 'tasa_snapshot' | 'tasa_origen' | 'tasa_fuente' | 'tasa_referencial'>
): string {
  const fuente = c.tasa_fuente ? FUENTE[c.tasa_fuente] : null
  if (c.tasa_origen === 'referencial') return `Referencial${fuente ? ` ${fuente}` : ''}`
  const desv = c.tasa_referencial != null ? desviacionPct(c.tasa_snapshot, c.tasa_referencial) : null
  return `Manual${
    c.tasa_referencial != null
      ? ` (referencial${fuente ? ` ${fuente}` : ''} ${formatTasa(c.tasa_referencial)}${
          desv != null ? `, ${desv >= 0 ? '+' : ''}${desv.toFixed(1)} %` : ''
        })`
      : ''
  }`
}
