/**
 * IVA opcional (18): funciones puras, sin imports de Supabase.
 *
 * El IVA de una factura es sí/no: sí = `config_negocio.iva_pct` vigente,
 * no = 0 %. Una factura sin IVA es `iva_pct = 0` (sin booleano aparte), y se
 * rotula siempre «Sin IVA» (nunca «IVA (0 %)»).
 */

const pctFormatter = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 })

/** `iva_pct` de una venta: el configurado si aplica IVA; si no, 0. */
export function ivaPctVenta(aplica: boolean, configPct: number): number {
  return aplica ? configPct : 0
}

/** `true` si la factura lleva IVA (`iva_pct > 0`). */
export function facturaConIva(f: { iva_pct: number }): boolean {
  return f.iva_pct > 0
}

/** `16` → «16 %», `12.5` → «12,5 %». */
export function formatIvaPct(pct: number): string {
  return `${pctFormatter.format(pct)} %`
}

/** «IVA (16 %)» o «Sin IVA» si el % es 0. */
export function etiquetaIva(pct: number): string {
  return pct > 0 ? `IVA (${formatIvaPct(pct)})` : 'Sin IVA'
}
