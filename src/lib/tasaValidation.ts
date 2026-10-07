import { z } from 'zod'
import type { EntradaTasaOperacion } from '@/lib/services/tasaService'
import {
  MSG_TASA_FUENTE_REQUERIDA,
  MSG_TASA_MAYOR_0,
  MSG_TASA_REQUERIDA,
} from './validationMessages'

/**
 * Campos de tasa de una operación (08-tasas): referencial (el servidor
 * recalcula el valor vigente) o manual (valor final > 0). `tasa` lleva
 * siempre el **valor final** que ve el usuario; la fuente es la de la
 * referencial elegida (o de la que se reemplazó con una manual).
 *
 * Los esquemas de entidad integran `camposTasa` + `validarTasa`
 * (`compraFormSchema`, `pagoProveedorFormSchema`, `pagoFormSchema`: el valor
 * final siempre se captura), o `camposTasaOpcionales` cuando el servidor
 * resuelve la referencial y el cliente puede no mandar valor
 * (`pedidoFormSchema` con `entrega_inmediata`, `entregaPedidoSchema`). Los
 * campos numéricos aceptan `null` como entrada (lo que emite `NumberField`
 * vacío) y salen `number`.
 */

/** Campos de tasa exigidos: el valor final > 0 siempre presente. */
export const camposTasa = {
  tasa_origen: z.enum(['referencial', 'manual']),
  tasa_fuente: z.enum(['bcv', 'paralela']).nullish(),
  tasa: z
    .number()
    .positive(MSG_TASA_MAYOR_0)
    .nullable()
    .refine((v) => v !== null, MSG_TASA_REQUERIDA)
    .transform((v) => v as number),
} as const

export const tasaSchema = z.object(camposTasa).superRefine(validarTasa)

export type TasaFormInput = z.input<typeof tasaSchema>
export type TasaFormValues = z.output<typeof tasaSchema>

/** Mismos campos sin exigir el valor: para esquemas que validan la tasa solo en algún caso. */
export const camposTasaOpcionales = {
  tasa_origen: z.enum(['referencial', 'manual']),
  tasa_fuente: z.enum(['bcv', 'paralela']).nullish(),
  tasa: z.number().positive(MSG_TASA_MAYOR_0).nullable(),
} as const

/** Valida los campos de tasa: valor final > 0 y, si es referencial, la fuente. */
export function validarTasa(
  v: Pick<TasaFormValues, 'tasa_origen' | 'tasa_fuente'> & { tasa: number | null },
  ctx: z.RefinementCtx
): void {
  if (!(v.tasa != null && v.tasa > 0)) {
    ctx.addIssue({ code: 'custom', path: ['tasa'], message: MSG_TASA_REQUERIDA })
  }
  if (v.tasa_origen === 'referencial' && !v.tasa_fuente) {
    ctx.addIssue({ code: 'custom', path: ['tasa_fuente'], message: MSG_TASA_FUENTE_REQUERIDA })
  }
}

/**
 * Desviación % de una tasa manual contra la referencial
 * (`(manual/referencial − 1) × 100`). `null` si no hay referencial válida
 * para comparar (sin referencial no hay desvío que calcular).
 */
export function desviacionPct(manual: number, referencial: number | null): number | null {
  if (referencial == null || !(referencial > 0) || !(manual > 0)) return null
  return (manual / referencial - 1) * 100
}

/**
 * Entrada lista para `tasaService.resolverTasaOperacion`: valor final,
 * origen y fuente. Hasta la Fase D (`TasaSelector`) los formularios capturan
 * un valor libre sin distinguir "copió la referencial" de "manual", así que
 * el puente envía la tasa como **manual** con la fuente de la referencial
 * que estaba visible; el servidor recalcula la referencial igual y guarda
 * el valor exacto que envió el usuario (la operación nunca falla por esto).
 */
export function entradaTasaDe(
  v: Pick<TasaFormValues, 'tasa_origen' | 'tasa_fuente'> & { tasa: number | null }
): EntradaTasaOperacion {
  const tasa = v.tasa != null && v.tasa > 0 ? v.tasa : null
  return {
    tasa_origen: v.tasa_origen === 'referencial' && tasa != null ? 'referencial' : 'manual',
    tasa_fuente: v.tasa_fuente ?? null,
    tasa: tasa ?? undefined,
  }
}
