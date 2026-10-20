import { z } from 'zod'
import { camposTasaOpcionales, validarTasa } from './tasaValidation'
import {
  MSG_COSTO_6_DECIMALES,
  MSG_COSTO_NO_NEGATIVO,
  MSG_COSTO_REQUERIDO,
  MSG_FECHA_INVALIDA,
  MSG_LINEAS_NO_COINCIDEN,
  MSG_MOTIVO_EDICION_COMPRA,
  MSG_MOTIVO_MAX_500,
  MSG_PESO_3_DECIMALES,
  MSG_PESO_MAYOR_0,
  MSG_PESO_REQUERIDO,
  MSG_PROVEEDOR_REQUERIDO,
} from './validationMessages'

/**
 * Edición de una compra registrada (19, solo admin): cabecera (proveedor,
 * fecha, condición, moneda, notas), tasa solo si `cambiar_tasa` (los campos
 * de `camposTasa` se exigen entonces) y kg y costo/kg (en la moneda de la
 * compra) de **todas** sus líneas, con motivo obligatorio. Los números llegan
 * `null` mientras el campo está vacío (`NumberField`). La RPC repite las
 * validaciones.
 */

/** ¿Tiene como máximo `n` decimales? (con margen para el error de coma flotante). */
const conDecimales = (v: number, n: number) => {
  const escala = 10 ** n
  return Math.abs(v * escala - Math.round(v * escala)) < 1e-6
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const itemEdicionCompraSchema = z.object({
  compra_item_id: z.string().uuid(MSG_LINEAS_NO_COINCIDEN),
  peso_kg: z
    .number({ message: MSG_PESO_REQUERIDO })
    .nullable()
    .refine((v) => v !== null, MSG_PESO_REQUERIDO)
    .transform((v) => v as number)
    .pipe(z.number().positive(MSG_PESO_MAYOR_0).refine((v) => conDecimales(v, 3), MSG_PESO_3_DECIMALES)),
  /** Costo/kg en la moneda (final) de la compra. */
  costo_kg: z
    .number({ message: MSG_COSTO_REQUERIDO })
    .nullable()
    .refine((v) => v !== null, MSG_COSTO_REQUERIDO)
    .transform((v) => v as number)
    .pipe(z.number().min(0, MSG_COSTO_NO_NEGATIVO).refine((v) => conDecimales(v, 6), MSG_COSTO_6_DECIMALES)),
})

export const editarCompraSchema = z
  .object({
    compra_id: z.string().uuid('Compra inválida'),
    proveedor_id: z.string().uuid(MSG_PROVEEDOR_REQUERIDO),
    fecha: z.string().regex(FECHA_REGEX, MSG_FECHA_INVALIDA),
    condicion: z.enum(['contado', 'credito']),
    moneda: z.enum(['usd', 'bs']),
    notas: z.string().max(500, MSG_MOTIVO_MAX_500),
    /** `false` conserva las cinco columnas de tasa (aunque cambie la fecha). */
    cambiar_tasa: z.boolean(),
    ...camposTasaOpcionales,
    items: z.array(itemEdicionCompraSchema).min(1, MSG_LINEAS_NO_COINCIDEN),
    motivo: z.string().trim().min(5, MSG_MOTIVO_EDICION_COMPRA).max(500, MSG_MOTIVO_MAX_500),
  })
  .superRefine((v, ctx) => {
    if (v.cambiar_tasa) validarTasa(v, ctx)
  })

export type EditarCompraInput = z.input<typeof editarCompraSchema>
export type EditarCompraValues = z.output<typeof editarCompraSchema>
