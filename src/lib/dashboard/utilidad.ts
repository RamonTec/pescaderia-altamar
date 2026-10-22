import type { UtilidadNeta } from '@/types/domain'

function round6(val: number): number {
  return Math.round((val + Number.EPSILON) * 1_000_000) / 1_000_000
}

/**
 * Calcula la utilidad neta a partir del margen bruto, los gastos confirmados
 * y las ventas del período (20-gastos, Fase D).
 *
 * - Utilidad neta = margen bruto − gastos
 * - Margen neto % = utilidad neta / ventas (fracción para formatPct)
 * - Si ventas <= 0, el porcentaje es null
 */
export function utilidadNeta(
  margenBruto: number,
  gastos: number,
  ventas: number
): UtilidadNeta {
  const utilidad_neta_usd = round6(margenBruto - gastos)
  const margen_neto_pct =
    ventas > 0 ? round6(utilidad_neta_usd / ventas) : null

  return {
    ventas_usd: round6(ventas),
    margen_bruto_usd: round6(margenBruto),
    gastos_usd: round6(gastos),
    utilidad_neta_usd,
    margen_neto_pct,
  }
}
