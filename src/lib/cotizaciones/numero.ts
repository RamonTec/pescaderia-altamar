/**
 * Numeración de cotizaciones (21-cotizaciones, P3): `123` → `COT-000123`.
 */

export function formatNumeroCotizacion(n: number): string {
  return `COT-${String(n).padStart(6, '0')}`
}

/**
 * Número buscado en `q`: `cot123`, `COT-000123`, `cot-12` o `123` → 123.
 * `null` si `q` no parece un número de cotización.
 */
export function parseBusquedaNumero(q: string): number | null {
  const m = /^\s*(?:cot[\s-]*)?0*(\d{1,12})\s*$/i.exec(q)
  if (!m) return null
  const n = Number(m[1])
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
