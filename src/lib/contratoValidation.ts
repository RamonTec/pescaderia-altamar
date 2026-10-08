import { z } from 'zod'
import type { EstadoContrato } from '@/types/domain'
import {
  MSG_DIAS_ENTERO,
  MSG_DIAS_MAX_365,
  MSG_DIAS_NO_NEGATIVO,
  MSG_DIAS_REQUERIDOS,
} from './validationMessages'

/**
 * Validación de contratos (06-contratos): generar desde una factura o una
 * compra a crédito, cambiar el estado y filtros del listado (`/contratos`).
 */

/** Transiciones permitidas; la misma tabla que el trigger `contratos_validar`. */
export const TRANSICIONES_CONTRATO: Record<EstadoContrato, readonly EstadoContrato[]> = {
  generado: ['enviado', 'firmado', 'anulado'],
  enviado: ['firmado', 'anulado'],
  firmado: ['anulado'],
  anulado: [],
}

export function transicionValida(desde: EstadoContrato, hacia: EstadoContrato): boolean {
  return TRANSICIONES_CONTRATO[desde].includes(hacia)
}

/** Entero 0–365 obligatorio. `null` (campo vacío) → "Días requeridos". */
export const diasCreditoContratoSchema = z
  .number({ message: MSG_DIAS_REQUERIDOS })
  .nullable()
  .refine((v) => v !== null, MSG_DIAS_REQUERIDOS)
  .transform((v) => v as number)
  .pipe(
    z
      .number()
      .int(MSG_DIAS_ENTERO)
      .min(0, MSG_DIAS_NO_NEGATIVO)
      .max(365, MSG_DIAS_MAX_365)
  )

const notasSchema = z
  .string()
  .trim()
  .max(500, 'Máximo 500 caracteres')
  .optional()
  .transform((v) => (v ? v : null))

export const generarContratoSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('venta_credito'),
    factura_id: z.uuid('Factura inválida'),
    dias_credito: diasCreditoContratoSchema,
    notas: notasSchema,
  }),
  z.object({
    tipo: z.literal('compra_credito'),
    compra_id: z.uuid('Compra inválida'),
    dias_credito: diasCreditoContratoSchema,
    notas: notasSchema,
  }),
])

export type GenerarContratoInput = z.input<typeof generarContratoSchema>
export type GenerarContratoValues = z.output<typeof generarContratoSchema>

/** Campos del diálogo (el origen llega por props). */
export const generarContratoFormSchema = z.object({
  dias_credito: diasCreditoContratoSchema,
  notas: z.string().trim().max(500, 'Máximo 500 caracteres'),
})

export type GenerarContratoFormInput = z.input<typeof generarContratoFormSchema>
export type GenerarContratoFormValues = z.output<typeof generarContratoFormSchema>

export const cambiarEstadoContratoSchema = z.object({
  id: z.uuid('Contrato inválido'),
  estado: z.enum(['enviado', 'firmado', 'anulado']),
})

export type CambiarEstadoContratoInput = z.infer<typeof cambiarEstadoContratoSchema>

export const FILTROS_ESTADO_CONTRATO = [
  'activos',
  'generado',
  'enviado',
  'firmado',
  'anulado',
  'todos',
] as const

/** Params de `/contratos`. Valores inválidos caen en el default (no rompen la página). */
export const filtrosContratosSchema = z.object({
  pagina: z.coerce.number().int().min(1).catch(1).default(1),
  /** Tamaño de página elegido en la tabla (25/50/100). */
  limite: z.coerce
    .number()
    .refine((n) => n === 25 || n === 50 || n === 100)
    .catch(25)
    .default(25),
  tipo: z.enum(['venta', 'compra']).optional().catch(undefined),
  estado: z.enum(FILTROS_ESTADO_CONTRATO).catch('activos').default('activos'),
  q: z
    .string()
    .trim()
    .max(80)
    .optional()
    .catch(undefined)
    .transform((v) => (v ? v : undefined)),
})

export type FiltrosContratos = z.output<typeof filtrosContratosSchema>
