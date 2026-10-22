import type { Moneda } from '@/types/domain'
import { tipoPeriodoNomina } from './periodos'

/**
 * Montos de un gasto (20-gastos). Funciones puras: sin Supabase ni React.
 *
 * `monto_usd` sigue la regla de compras (19) y la del check
 * `gastos_monto_usd`:
 *
 *   moneda = 'usd' ? round(monto, 6) : round(monto / tasa, 6)
 *
 * El check compara por igualdad exacta, así que el redondeo se hace en
 * aritmética entera (micro-unidades, `BigInt`) y no con `Math.round` sobre
 * un `number`: `round` de Postgres sobre `numeric` es exacto y redondea la
 * mitad hacia arriba (alejándose de cero). Los montos y tasas son
 * `numeric(14,6)`: en micro-unidades caben de sobra en un entero seguro.
 */

const ESCALA = BigInt(1_000_000)
const CERO = BigInt(0)
const DOS = BigInt(2)

/** Valor `numeric(14,6)` en micro-unidades (entero). */
function aMicro(n: number): bigint {
  return BigInt(Math.round(n * 1e6))
}

/** `round(n, 6)` exacto, devuelto como el `number` más cercano. */
export function redondea6Gasto(n: number): number {
  return Number(aMicro(n)) / 1e6
}

/**
 * Monto del gasto en USD con la tasa snapshot (Bs por USD). Lanza si la
 * tasa no es positiva en un gasto en Bs (el check no admitiría la fila).
 */
export function montoUsdGasto(moneda: Moneda, monto: number, tasa: number): number {
  const m = aMicro(monto)
  if (moneda === 'usd') return Number(m) / 1e6
  const t = aMicro(tasa)
  if (t <= CERO) throw new Error('La tasa debe ser mayor que 0')
  // round(m / t, 6) = round(m · 10⁶ / t) / 10⁶; mitad hacia arriba (positivos).
  const negativo = m < CERO
  const abs = negativo ? -m : m
  const q = (DOS * abs * ESCALA + t) / (DOS * t)
  return Number(negativo ? -q : q) / 1e6
}

/** Equivalente en Bs de un monto en USD a la tasa snapshot del gasto (sin revaluar). */
export function equivalenteBsGasto(montoUsd: number, tasa: number): number {
  return montoUsd * tasa
}

/**
 * Monto precargado de un pago de nómina (P3: `salario_base` es mensual).
 *
 * - Mes calendario completo → el salario.
 * - Quincena (1–15 o 16–último día) → `round(salario / 2, 6)` (mitad hacia
 *   arriba, como `round` de Postgres sobre `numeric`).
 * - Cualquier otro período → `null` (sin precarga: el admin indica el monto).
 *
 * Es solo una precarga: el monto es editable al registrar el pago.
 */
export function montoNominaPeriodo(salarioMensual: number, periodoDesde: string, periodoHasta: string): number | null {
  const tipo = tipoPeriodoNomina(periodoDesde, periodoHasta)
  if (tipo === null || !(salarioMensual >= 0)) return null
  const s = aMicro(salarioMensual)
  if (tipo === 'mes') return Number(s) / 1e6
  // round(s / 2): exacto si es par; con resto, la mitad sube (positivos).
  return Number((s + BigInt(1)) / DOS) / 1e6
}

/** Resumen del costo de un empleado a partir de sus pagos confirmados. */
export function resumirCostoEmpleado(
  pagos: readonly { monto_usd: number; tasa_snapshot: number | null }[],
  meses: number
): { total_usd: number; total_bs: number; n_pagos: number; promedio_mensual_usd: number } {
  let usd = 0
  let bs = 0
  for (const p of pagos) {
    usd += p.monto_usd
    bs += p.tasa_snapshot === null ? 0 : equivalenteBsGasto(p.monto_usd, p.tasa_snapshot)
  }
  const total_usd = redondea6Gasto(usd)
  return {
    total_usd,
    total_bs: Math.round(bs * 100) / 100,
    n_pagos: pagos.length,
    promedio_mensual_usd: redondea6Gasto(total_usd / Math.max(1, meses)),
  }
}
