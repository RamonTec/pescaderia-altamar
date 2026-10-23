import { z } from 'zod'
import { fechaHoy } from './format'
import { TELEFONO_VE_REGEX } from './clienteValidation'
import { totalesCotizacion } from './cotizaciones/totales'
import {
  MSG_COT_CLIENTE_NOMBRE,
  MSG_COT_CLIENTE_REQUERIDO,
  MSG_COT_DESCUENTO_MAYOR,
  MSG_COT_DESCUENTO_NEGATIVO,
  MSG_COT_FECHA_FUTURA,
  MSG_COT_MAX_LINEAS,
  MSG_COT_PRODUCTO_REQUERIDO,
  MSG_COT_SIN_LINEAS,
  MSG_COT_TELEFONO_INVALIDO,
  MSG_COT_VALIDEZ,
  MSG_FECHA_INVALIDA,
  MSG_MAX_1000,
  MSG_MAX_200,
  MSG_MAX_2000,
  MSG_MAX_500,
  MSG_PESO_3_DECIMALES,
  MSG_PESO_MAYOR_0,
  MSG_PESO_REQUERIDO,
  MSG_PRECIO_6_DECIMALES,
  MSG_PRECIO_NO_NEGATIVO,
  MSG_PRECIO_REQUERIDO,
} from './validationMessages'

/**
 * Validación de cotizaciones (21-cotizaciones).
 *
 * - `cotizacionFormSchema`: `CotizacionForm` (crear / editar / duplicar /
 *   renovar). Cliente registrado xor libre; 1–50 líneas; kg > 0 con 3
 *   decimales; precio ≥ 0 con 6; descuento ≤ subtotal (P2); validez 1–90;
 *   fecha ≤ hoy. El IVA es el interruptor `con_iva` (P1): el servidor
 *   resuelve el % vigente. La RPC vuelve a validar todo.
 * - `responderCotizacionSchema`: aceptar o rechazar (motivo opcional ≤ 500).
 * - `anularCotizacionSchema`: motivo opcional ≤ 500.
 *
 * Los textos opcionales llegan como `''`; el servicio los guarda como `null`.
 */

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
export const MAX_LINEAS_COTIZACION = 50

function requerido(mensaje: string, base: z.ZodNumber) {
  return base
    .nullable()
    .refine((v) => v !== null, mensaje)
    .transform((v) => v as number)
}

const decimales = (n: number, d: number) => Math.abs(Math.round(n * 10 ** d) - n * 10 ** d) < 1e-6

export const cotizacionItemFormSchema = z.object({
  producto_id: z.string().uuid(MSG_COT_PRODUCTO_REQUERIDO),
  peso_kg: requerido(
    MSG_PESO_REQUERIDO,
    z.number().positive(MSG_PESO_MAYOR_0).refine((v) => decimales(v, 3), MSG_PESO_3_DECIMALES)
  ),
  precio_usd_kg: requerido(
    MSG_PRECIO_REQUERIDO,
    z.number().min(0, MSG_PRECIO_NO_NEGATIVO).refine((v) => decimales(v, 6), MSG_PRECIO_6_DECIMALES)
  ),
  nota: z.string().trim().max(200, MSG_MAX_200),
})

export const cotizacionFormSchema = z
  .object({
    tipo_cliente: z.enum(['registrado', 'libre']),
    cliente_id: z.string().nullable(),
    cliente_nombre: z.string().trim(),
    cliente_telefono: z.string().trim(),
    fecha: z
      .string()
      .regex(FECHA_REGEX, MSG_FECHA_INVALIDA)
      .refine((v) => v <= fechaHoy(), MSG_COT_FECHA_FUTURA),
    validez_dias: requerido(MSG_COT_VALIDEZ, z.number().int(MSG_COT_VALIDEZ).min(1, MSG_COT_VALIDEZ).max(90, MSG_COT_VALIDEZ)),
    con_iva: z.boolean(),
    descuento_usd: z
      .number()
      .min(0, MSG_COT_DESCUENTO_NEGATIVO)
      .nullable()
      .transform((v) => v ?? 0),
    notas_cliente: z.string().trim().max(1000, MSG_MAX_1000),
    notas_internas: z.string().trim().max(500, MSG_MAX_500),
    terminos: z.string().trim().max(2000, MSG_MAX_2000),
    items: z
      .array(cotizacionItemFormSchema)
      .min(1, MSG_COT_SIN_LINEAS)
      .max(MAX_LINEAS_COTIZACION, MSG_COT_MAX_LINEAS),
  })
  .superRefine((v, ctx) => {
    if (v.tipo_cliente === 'registrado') {
      if (!v.cliente_id || !z.string().uuid().safeParse(v.cliente_id).success) {
        ctx.addIssue({ code: 'custom', path: ['cliente_id'], message: MSG_COT_CLIENTE_REQUERIDO })
      }
    } else {
      if (v.cliente_nombre.length < 2 || v.cliente_nombre.length > 120) {
        ctx.addIssue({ code: 'custom', path: ['cliente_nombre'], message: MSG_COT_CLIENTE_NOMBRE })
      }
      if (v.cliente_telefono && !TELEFONO_VE_REGEX.test(v.cliente_telefono)) {
        ctx.addIssue({ code: 'custom', path: ['cliente_telefono'], message: MSG_COT_TELEFONO_INVALIDO })
      }
    }
    const { subtotal_usd } = totalesCotizacion(v.items, 0, 0)
    if (v.descuento_usd > subtotal_usd) {
      ctx.addIssue({ code: 'custom', path: ['descuento_usd'], message: MSG_COT_DESCUENTO_MAYOR })
    }
  })

export type CotizacionFormInput = z.input<typeof cotizacionFormSchema>
export type CotizacionFormValues = z.output<typeof cotizacionFormSchema>
export type CotizacionItemFormInput = z.input<typeof cotizacionItemFormSchema>

export const responderCotizacionSchema = z.object({
  id: z.string().uuid(),
  respuesta: z.enum(['aceptada', 'rechazada']),
  motivo: z.string().trim().max(500, MSG_MAX_500),
})
export type ResponderCotizacionInput = z.input<typeof responderCotizacionSchema>

export const anularCotizacionSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().max(500, MSG_MAX_500),
})
export type AnularCotizacionInput = z.input<typeof anularCotizacionSchema>

export const FILTROS_ESTADO_COTIZACION = [
  'abiertas',
  'todas',
  'borrador',
  'enviada',
  'vencida',
  'aceptada',
  'rechazada',
  'anulada',
] as const

/** Filtros del listado en la URL (`?estado=`, `?q=`, `?desde`/`?hasta`, `?pagina=`, `?limite=`). */
export const filtrosCotizacionesSchema = z
  .object({
    pagina: z.coerce.number().int().min(1).catch(1).default(1),
    limite: z.coerce
      .number()
      .refine((n) => n === 25 || n === 50 || n === 100)
      .catch(25)
      .default(25),
    estado: z.enum(FILTROS_ESTADO_COTIZACION).catch('abiertas').default('abiertas'),
    q: z
      .string()
      .trim()
      .max(80)
      .optional()
      .catch(undefined)
      .transform((v) => (v ? v : undefined)),
    desde: z.string().regex(FECHA_REGEX).optional().catch(undefined),
    hasta: z.string().regex(FECHA_REGEX).optional().catch(undefined),
  })
  .transform((v) =>
    // El rango solo cuenta completo y ordenado.
    v.desde && v.hasta && v.desde <= v.hasta ? v : { ...v, desde: undefined, hasta: undefined }
  )

export type FiltrosCotizacionesUrl = z.output<typeof filtrosCotizacionesSchema>
