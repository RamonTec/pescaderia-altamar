import { z } from 'zod'
import { fechaHoy } from './format'
import { camposTasa, validarTasa } from './tasaValidation'
import {
  MSG_FECHA_INVALIDA,
  MSG_GASTO_CATEGORIA_REQUERIDA,
  MSG_GASTO_DESCRIPCION,
  MSG_GASTO_FECHA_FUTURA,
  MSG_GASTO_MONTO_MAYOR_0,
  MSG_GASTO_MONTO_REQUERIDO,
  MSG_GASTO_MOTIVO_ANULACION,
  MSG_GASTO_PERIODO_INCOMPLETO,
  MSG_GASTO_PERIODO_ORDEN,
  MSG_MAX_120,
  MSG_MAX_500,
  MSG_MAX_80,
  MSG_NOMINA_EMPLEADO_REQUERIDO,
  MSG_NOMINA_PERIODO_REQUERIDO,
} from './validationMessages'

/**
 * Validación de gastos operativos (20-gastos).
 *
 * - `gastoFormSchema`: alta manual (modos `crear` y `registrar_de_nuevo` de
 *   `GastoForm`). Tasa con `camposTasa` + `validarTasa` (08-tasas); el
 *   servidor la resuelve con `resolverTasaOperacion` y calcula `monto_usd`.
 * - `pagoNominaSchema` (Fase B): lo mismo + empleado y período obligatorios.
 * - `editarGastoSchema`: edición de un confirmado según P1 (b): solo
 *   descripción, beneficiario, referencia y notas.
 * - `anularGastoSchema` (motivo 5–500) y `descartarGastoSchema` (motivo
 *   opcional ≤ 500, para los pendientes de la Fase C).
 *
 * Los textos opcionales llegan como `''` desde el formulario; el servicio
 * los guarda como `null`.
 */

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const METODOS_PAGO_GASTO = [
  'efectivo_usd',
  'efectivo_bs',
  'pago_movil',
  'zelle',
  'transferencia',
  'punto',
] as const

const fechaGasto = z
  .string()
  .regex(FECHA_REGEX, MSG_FECHA_INVALIDA)
  .refine((v) => v <= fechaHoy(), MSG_GASTO_FECHA_FUTURA)

const fechaOpcional = z.string().regex(FECHA_REGEX, MSG_FECHA_INVALIDA).or(z.literal(''))

const descripcion = z.string().trim().min(3, MSG_GASTO_DESCRIPCION).max(200, MSG_GASTO_DESCRIPCION)
const beneficiario = z.string().trim().max(120, MSG_MAX_120)
const referencia = z.string().trim().max(80, MSG_MAX_80)
const notas = z.string().trim().max(500, MSG_MAX_500)

const gastoCampos = z.object({
  fecha: fechaGasto,
  categoria_id: z.string().uuid(MSG_GASTO_CATEGORIA_REQUERIDA),
  descripcion,
  beneficiario,
  moneda: z.enum(['usd', 'bs']),
  /** Monto en la moneda del gasto (la UI captura 2 decimales). */
  monto: z
    .number()
    .positive(MSG_GASTO_MONTO_MAYOR_0)
    .nullable()
    .refine((v) => v !== null, MSG_GASTO_MONTO_REQUERIDO)
    .transform((v) => v as number),
  ...camposTasa,
  metodo_pago: z.enum(METODOS_PAGO_GASTO).nullable(),
  referencia,
  notas,
  periodo_desde: fechaOpcional,
  periodo_hasta: fechaOpcional,
})

type GastoCamposValues = z.output<typeof gastoCampos>

/** Reglas comunes: tasa (08) y período ambos-o-ninguno con `desde ≤ hasta`. */
function refinarGasto(v: GastoCamposValues, ctx: z.RefinementCtx) {
  validarTasa(v, ctx)
  const conDesde = v.periodo_desde !== ''
  const conHasta = v.periodo_hasta !== ''
  if (conDesde !== conHasta) {
    ctx.addIssue({
      code: 'custom',
      path: [conDesde ? 'periodo_hasta' : 'periodo_desde'],
      message: MSG_GASTO_PERIODO_INCOMPLETO,
    })
  } else if (conDesde && v.periodo_desde > v.periodo_hasta) {
    ctx.addIssue({ code: 'custom', path: ['periodo_hasta'], message: MSG_GASTO_PERIODO_ORDEN })
  }
}

export const gastoFormSchema = gastoCampos.superRefine(refinarGasto)

export type GastoFormInput = z.input<typeof gastoFormSchema>
export type GastoFormValues = z.output<typeof gastoFormSchema>

/**
 * Pago de nómina (Fase B, modo `nomina` de `GastoForm`): un gasto de la
 * categoría Nómina con empleado y período obligatorios. El servidor fija la
 * categoría Nómina (no confía en la del cliente) y la base exige empleado
 * activo (`gastos_guard`).
 */
export const pagoNominaSchema = gastoCampos
  .extend({ empleado_id: z.string().uuid(MSG_NOMINA_EMPLEADO_REQUERIDO) })
  .superRefine((v, ctx) => {
    refinarGasto(v, ctx)
    if (v.periodo_desde === '' && v.periodo_hasta === '') {
      ctx.addIssue({ code: 'custom', path: ['periodo_desde'], message: MSG_NOMINA_PERIODO_REQUERIDO })
    }
  })

export type PagoNominaInput = z.input<typeof pagoNominaSchema>
export type PagoNominaValues = z.output<typeof pagoNominaSchema>

/** Consulta de pagos con período solapado (aviso sin bloqueo). */
export const solapadosNominaSchema = z.object({
  empleado_id: z.string().uuid(),
  periodo_desde: z.string().regex(FECHA_REGEX),
  periodo_hasta: z.string().regex(FECHA_REGEX),
})

/** P1 (b): un confirmado solo cambia estos campos. */
export const editarGastoSchema = z.object({
  id: z.string().uuid(),
  descripcion,
  beneficiario,
  referencia,
  notas,
})

export type EditarGastoInput = z.input<typeof editarGastoSchema>
export type EditarGastoValues = z.output<typeof editarGastoSchema>

export const anularGastoSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().min(5, MSG_GASTO_MOTIVO_ANULACION).max(500, MSG_MAX_500),
})

export type AnularGastoValues = z.output<typeof anularGastoSchema>

export const descartarGastoSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().max(500, MSG_MAX_500),
})

export type DescartarGastoValues = z.output<typeof descartarGastoSchema>

/** Filtro de estado del listado (`?estado=`). */
export const FILTROS_ESTADO_GASTO = ['confirmado', 'pendiente', 'cerrados', 'todos'] as const
export type FiltroEstadoGasto = (typeof FILTROS_ESTADO_GASTO)[number]

export function filtroEstadoDesdeParam(v: string | string[] | undefined): FiltroEstadoGasto {
  const valor = Array.isArray(v) ? v[0] : v
  return (FILTROS_ESTADO_GASTO as readonly string[]).includes(valor ?? '')
    ? (valor as FiltroEstadoGasto)
    : 'confirmado'
}
