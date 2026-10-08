import { z } from 'zod'
import type { DiasFlujo, RangoFechas } from '@/types/domain'
import {
  MAX_DIAS_RANGO,
  PRESET_DEFAULT,
  diferenciaDias,
  rangoDesdePreset,
} from '@/lib/dashboard/rangos'

/**
 * Validación de los parámetros del dashboard (15): `?desde`/`?hasta` y
 * `?flujo`. Se valida en el servidor (`page.tsx`); un valor ausente o
 * inválido cae al default (rango "Mes en curso", flujo de 7 días), nunca a
 * un error.
 */

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` que además es una fecha real (rechaza `2026-02-30`). */
const fechaIso = z
  .string()
  .regex(FECHA_REGEX, 'Fecha inválida')
  .refine((v) => {
    const [y, m, d] = v.split('-').map(Number)
    const f = new Date(Date.UTC(y, m - 1, d))
    return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
  }, 'Fecha inválida')

export const rangoFechasSchema = z
  .object({ desde: fechaIso, hasta: fechaIso })
  .refine((r) => r.desde <= r.hasta, {
    message: 'La fecha inicial no puede ser posterior a la final',
    path: ['hasta'],
  })
  .refine((r) => diferenciaDias(r.desde, r.hasta) + 1 <= MAX_DIAS_RANGO, {
    message: `El rango no puede superar ${MAX_DIAS_RANGO} días`,
    path: ['hasta'],
  })

export const diasFlujoSchema = z.union([z.literal(7), z.literal(30)])

type Param = string | string[] | undefined

function primero(v: Param): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/** Rango de `?desde`/`?hasta`; si falta o es inválido, "Mes en curso". */
export function rangoDesdeParams(
  params: { desde?: Param; hasta?: Param },
  hoy: string
): { rango: RangoFechas; valido: boolean } {
  const r = rangoFechasSchema.safeParse({ desde: primero(params.desde), hasta: primero(params.hasta) })
  return r.success
    ? { rango: r.data, valido: true }
    : { rango: rangoDesdePreset(PRESET_DEFAULT, hoy), valido: false }
}

/** `?flujo=7|30`; por defecto 7. */
export function diasFlujoDesdeParam(v: Param): DiasFlujo {
  const r = diasFlujoSchema.safeParse(Number(primero(v)))
  return r.success ? r.data : 7
}

/** `?producto=<uuid>` del filtro del spread (B5); inválido o ausente → todos. */
export function productoSpreadDesdeParam(v: Param): string | null {
  const r = z.string().uuid().safeParse(primero(v))
  return r.success ? r.data : null
}
