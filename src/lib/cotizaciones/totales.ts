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
 *
 * Desvío documentado: misma regla y redondeo que `src/lib/facturas/totales.ts`
 * (`subtotalItems`/`ivaSobre`/`redondea6`), pero en aritmética decimal exacta
 * con `bigint` (millonésimas). Con `number` el producto peso × precio (hasta
 * 9 decimales) caía a veces del lado equivocado del medio y la paridad con
 * `numeric` fallaba en ~1 de 30 casos aleatorios (`probar-cotizaciones.ts --sql`).
 */
import type { TotalesCotizacion } from '@/types/domain'

/** Entero escalado: `n × 10^d`, redondeado (las entradas ya traen ≤ d decimales). */
function escala(n: number, d: number): bigint {
  return BigInt(Math.round(n * 10 ** d))
}

/** División entera redondeando la mitad lejos de cero (como `round()` de `numeric`). */
function divRedondeo(a: bigint, b: bigint): bigint {
  const neg = a < CERO
  const abs = neg ? -a : a
  const q = (abs * DOS + b) / (b * DOS)
  return neg ? -q : q
}

const CERO = BigInt(0)
const DOS = BigInt(2)
const MIL = BigInt(1000)
const DIEZ_MIL = BigInt(10_000)

const aNumero = (micro: bigint) => Number(micro) / 1e6

/** Subtotal de una línea en millonésimas de USD. */
function lineaMicro(peso: number, precio: number): bigint {
  // peso (milésimas) × precio (millonésimas) = 10⁻⁹ → redondeo a 10⁻⁶.
  return divRedondeo(escala(peso, 3) * escala(precio, 6), MIL)
}

/** Subtotal de una línea redondeado a 6 decimales (como el check de `cotizacion_items`). */
export function subtotalLinea(linea: { peso_kg: number; precio_usd_kg: number }): number {
  return aNumero(lineaMicro(linea.peso_kg, linea.precio_usd_kg))
}

const finito = (n: number | null | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

/**
 * Subtotal, descuento, IVA y total. Las líneas incompletas (peso o precio
 * `null`/no finito) cuentan 0, para el resumen en vivo del formulario.
 */
export function totalesCotizacion(
  items: readonly { peso_kg: number | null; precio_usd_kg: number | null }[],
  descuento: number | null,
  ivaPct: number
): TotalesCotizacion {
  const subtotal = items.reduce((s, i) => s + lineaMicro(finito(i.peso_kg), finito(i.precio_usd_kg)), CERO)
  const desc = escala(finito(descuento), 6)
  const base = subtotal - desc
  // base (10⁻⁶) × pct (centésimas) / 100 = 10⁻¹⁰ → redondeo a 10⁻⁶.
  const iva = divRedondeo(base * escala(ivaPct, 2), DIEZ_MIL)
  return {
    subtotal_usd: aNumero(subtotal),
    descuento_usd: aNumero(desc),
    iva_usd: aNumero(iva),
    total_usd: aNumero(base + iva),
  }
}
