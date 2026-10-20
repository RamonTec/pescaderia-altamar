import { z } from 'zod'
import {
  MSG_APLICA_IVA_REQUERIDO,
  MSG_MOTIVO_CAMBIO_IVA,
  MSG_MOTIVO_CORRECCION,
  MSG_MOTIVO_MAX_500,
  MSG_PESO_3_DECIMALES,
  MSG_PESO_MAYOR_0,
  MSG_PESO_REQUERIDO,
  MSG_PRECIO_6_DECIMALES,
  MSG_PRECIO_NO_NEGATIVO,
  MSG_PRECIO_REQUERIDO,
} from './validationMessages'

/**
 * Corrección de una línea de factura (17): solo el peso y el precio/kg, con
 * motivo obligatorio. Los números llegan `null` mientras el campo está vacío
 * (`NumberField`). La RPC repite las validaciones.
 */

/** ¿Tiene como máximo `n` decimales? (con margen para el error de coma flotante). */
const conDecimales = (v: number, n: number) => {
  const escala = 10 ** n
  return Math.abs(v * escala - Math.round(v * escala)) < 1e-6
}

export const corregirLineaSchema = z.object({
  /** Factura de la línea: el servicio comprueba que la línea es suya (límite y revalidación). */
  factura_id: z.string().uuid('Factura inválida'),
  factura_item_id: z.string().uuid('Línea inválida'),
  peso_kg: z
    .number({ message: MSG_PESO_REQUERIDO })
    .nullable()
    .refine((v) => v !== null, MSG_PESO_REQUERIDO)
    .transform((v) => v as number)
    .pipe(
      z
        .number()
        .positive(MSG_PESO_MAYOR_0)
        .refine((v) => conDecimales(v, 3), MSG_PESO_3_DECIMALES)
    ),
  precio_usd_kg: z
    .number({ message: MSG_PRECIO_REQUERIDO })
    .nullable()
    .refine((v) => v !== null, MSG_PRECIO_REQUERIDO)
    .transform((v) => v as number)
    .pipe(
      z
        .number()
        .min(0, MSG_PRECIO_NO_NEGATIVO)
        .refine((v) => conDecimales(v, 6), MSG_PRECIO_6_DECIMALES)
    ),
  motivo: z.string().trim().min(5, MSG_MOTIVO_CORRECCION).max(500, MSG_MOTIVO_MAX_500),
  /** Confirmación del aviso de límite de crédito (05 §4.1). */
  forzar_limite: z.boolean().optional(),
})

export type CorregirLineaInput = z.input<typeof corregirLineaSchema>
export type CorregirLineaValues = z.output<typeof corregirLineaSchema>

/**
 * Cambio de IVA de una factura emitida (18): activar (al % vigente) o
 * quitar, con motivo obligatorio. La RPC repite las validaciones.
 */
export const cambiarIvaSchema = z.object({
  factura_id: z.string().uuid('Factura inválida'),
  aplica_iva: z.boolean({ message: MSG_APLICA_IVA_REQUERIDO }),
  motivo: z.string().trim().min(5, MSG_MOTIVO_CAMBIO_IVA).max(500, MSG_MOTIVO_MAX_500),
  /** Confirmación del aviso de límite de crédito al activar (05 §4.1). */
  forzar_limite: z.boolean().optional(),
})

export type CambiarIvaInput = z.input<typeof cambiarIvaSchema>
export type CambiarIvaValues = z.output<typeof cambiarIvaSchema>
