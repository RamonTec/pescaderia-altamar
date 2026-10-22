import { z } from 'zod'
import { CEDULA_REGEX } from './clienteValidation'
import {
  MSG_CEDULA_INVALIDA,
  MSG_EMPLEADO_NOMBRE,
  MSG_EMPLEADO_SALARIO_NEGATIVO,
  MSG_EMPLEADO_SALARIO_REQUERIDO,
  MSG_MAX_500,
  MSG_MAX_80,
} from './validationMessages'

/**
 * Validación de empleados (20-gastos, Fase B): nombre 2–120, cédula con el
 * formato de `RifCiField` para personas (`V-`/`E-` + 6 a 10 dígitos, la
 * misma `CEDULA_REGEX` de clientes), cargo ≤ 80, salario base MENSUAL ≥ 0
 * (P3) en USD o Bs y notas ≤ 500. La cédula se normaliza en mayúsculas y
 * sin espacios antes de validar (la base tiene el mismo check y `unique`).
 */
export const empleadoSchema = z.object({
  /** Vacío al crear. */
  id: z.string().uuid().or(z.literal('')),
  nombre: z.string().trim().min(2, MSG_EMPLEADO_NOMBRE).max(120, MSG_EMPLEADO_NOMBRE),
  cedula: z
    .string()
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .pipe(z.string().regex(CEDULA_REGEX, MSG_CEDULA_INVALIDA)),
  cargo: z.string().trim().max(80, MSG_MAX_80),
  salario_base: z
    .number()
    .min(0, MSG_EMPLEADO_SALARIO_NEGATIVO)
    .nullable()
    .refine((v) => v !== null, MSG_EMPLEADO_SALARIO_REQUERIDO)
    .transform((v) => v as number),
  moneda: z.enum(['usd', 'bs']),
  notas: z.string().trim().max(500, MSG_MAX_500),
})

export type EmpleadoFormInput = z.input<typeof empleadoSchema>
export type EmpleadoFormValues = z.output<typeof empleadoSchema>

export const activarEmpleadoSchema = z.object({
  id: z.string().uuid(),
  activo: z.boolean(),
})

export type ActivarEmpleadoValues = z.output<typeof activarEmpleadoSchema>
