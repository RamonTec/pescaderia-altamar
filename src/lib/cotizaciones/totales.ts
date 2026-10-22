/**
 * Totales de una cotización (21-cotizaciones, P2): funciones puras, sin
 * imports de Supabase ni React. Espejo de `guardar_cotizacion` (fuente de
 * verdad en SQL):
 *   subtotal_linea = round(peso_kg × precio_usd_kg, 6)
 *   subtotal       = Σ subtotal_linea
 *   base           = subtotal − descuento
 *   iva            = round(base × iva_pct / 100, 6)
 *   total          = round(base + iva, 6)
 * Solo USD (P1): sin tasas ni equivalente en Bs.
 */
import type { TotalesCotizacion } from '@/types/domain'
import { ivaSobre, redondea6, subtotalItems, type LineaImporte } from '@/lib/facturas/totales'

/** Subtotal de una línea redondeado a 6 decimales (como el check de `cotizacion_items`). */
export function subtotalLinea(linea: LineaImporte): number {
  return subtotalItems([linea])
}

/**
 * Subtotal, descuento, IVA y total. Las líneas incompletas (peso o precio
 * `null`/no finito) cuentan 0, para el resumen en vivo del formulario.
 */
export function totalesCotizacion(
  items: readonly { peso_kg: number | null; precio_usd_kg: number | null }[],
  descuento: number | null,
  ivaPct: number
): TotalesCotizacion {
  const subtotal = redondea6(
    items.reduce((s, i) => {
      const peso = Number.isFinite(i.peso_kg) ? (i.peso_kg as number) : 0
      const precio = Number.isFinite(i.precio_usd_kg) ? (i.precio_usd_kg as number) : 0
      return s + subtotalLinea({ peso_kg: peso, precio_usd_kg: precio })
    }, 0)
  )
  const desc = redondea6(Number.isFinite(descuento) ? (descuento as number) : 0)
  const base = redondea6(subtotal - desc)
  const iva = ivaSobre(base, ivaPct)
  return { subtotal_usd: subtotal, descuento_usd: desc, iva_usd: iva, total_usd: redondea6(base + iva) }
}
