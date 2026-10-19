/**
 * Totales de una factura (05-ventas, movidos aquí en 17): funciones puras,
 * sin imports de Supabase, usables en el servidor y en componentes cliente.
 *
 * Mismo redondeo que la RPC `corregir_linea_factura`:
 *   subtotal = round(Σ peso × precio, 6)
 *   iva      = round(subtotal × iva_pct / 100, 6)
 *   total    = round(subtotal + iva, 6)
 */

export const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Lo mínimo de una línea para calcular el subtotal. */
export interface LineaImporte {
  peso_kg: number
  precio_usd_kg: number
}

export function subtotalItems(items: readonly LineaImporte[]): number {
  return redondea6(items.reduce((s, i) => s + i.peso_kg * i.precio_usd_kg, 0))
}

export function ivaSobre(subtotal: number, ivaPct: number): number {
  return redondea6(subtotal * (ivaPct / 100))
}

export interface TotalesFactura {
  subtotal_usd: number
  iva_usd: number
  total_usd: number
}

/** Subtotal, IVA y total de unas líneas con el `iva_pct` dado (el de la factura, no el vigente). */
export function totalesDe(items: readonly LineaImporte[], ivaPct: number): TotalesFactura {
  const subtotal = subtotalItems(items)
  const iva = ivaSobre(subtotal, ivaPct)
  return { subtotal_usd: subtotal, iva_usd: iva, total_usd: redondea6(subtotal + iva) }
}
