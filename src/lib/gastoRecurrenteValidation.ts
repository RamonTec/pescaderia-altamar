import { z } from 'zod'
import { METODOS_PAGO_GASTO } from './gastoValidation'
import {
  MSG_FECHA_INVALIDA,
  MSG_GASTO_CATEGORIA_REQUERIDA,
  MSG_GASTO_DESCRIPCION,
  MSG_GASTO_MONTO_MAYOR_0,
  MSG_MAX_120,
  MSG_RECURRENTE_DIA_MES,
  MSG_RECURRENTE_FECHA_INICIO,
  MSG_RECURRENTE_FECHAS_ORDEN,
  MSG_RECURRENTE_MONTO_O_EMPLEADO,
  MSG_RECURRENTE_NOMBRE,
} from './validationMessages'

/**
 * Esquema de validación para plantillas de gastos recurrentes (20-gastos, Fase C).
 */

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const fechaOpcional = z.string().regex(FECHA_REGEX, MSG_FECHA_INVALIDA).or(z.literal(''))

export const gastoRecurrenteSchema = z
  .object({
    nombre: z.string().trim().min(2, MSG_RECURRENTE_NOMBRE).max(80, MSG_RECURRENTE_NOMBRE),
    categoria_id: z.string().uuid(MSG_GASTO_CATEGORIA_REQUERIDA),
    empleado_id: z
      .string()
      .uuid()
      .or(z.literal(''))
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    descripcion: z.string().trim().min(3, MSG_GASTO_DESCRIPCION).max(200, MSG_GASTO_DESCRIPCION),
    beneficiario: z
      .string()
      .trim()
      .max(120, MSG_MAX_120)
      .or(z.literal(''))
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    moneda: z.enum(['usd', 'bs']),
    monto: z
      .number()
      .positive(MSG_GASTO_MONTO_MAYOR_0)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    frecuencia: z.enum(['mensual', 'quincenal']),
    dia_mes: z
      .number()
      .int()
      .min(1, MSG_RECURRENTE_DIA_MES)
      .max(28, MSG_RECURRENTE_DIA_MES)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    fecha_inicio: z.string().regex(FECHA_REGEX, MSG_RECURRENTE_FECHA_INICIO),
    fecha_fin: fechaOpcional
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    metodo_pago: z
      .enum(METODOS_PAGO_GASTO)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    activo: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // Si no hay monto y no hay empleado, error
    if ((data.monto === null || data.monto === undefined) && !data.empleado_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['monto'],
        message: MSG_RECURRENTE_MONTO_O_EMPLEADO,
      })
    }

    // Si la frecuencia es quincenal, dia_mes debe ser nulo
    if (data.frecuencia === 'quincenal' && data.dia_mes !== null && data.dia_mes !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['dia_mes'],
        message: 'El día del mes solo aplica para frecuencia mensual',
      })
    }

    // fecha_fin >= fecha_inicio
    if (data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['fecha_fin'],
        message: MSG_RECURRENTE_FECHAS_ORDEN,
      })
    }
  })

export type GastoRecurrenteInput = z.input<typeof gastoRecurrenteSchema>
export type GastoRecurrenteValues = z.output<typeof gastoRecurrenteSchema>
