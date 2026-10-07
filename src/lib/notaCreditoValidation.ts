import { z } from 'zod'

/**
 * Validación de notas de crédito (05-ventas §4.4).
 */

function numero(mensajeRequerido: string, base: z.ZodNumber = z.number()) {
  return base
    .nullable()
    .refine((v) => v !== null, mensajeRequerido)
    .transform((v) => v as number)
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const notaCreditoItemFormSchema = z.object({
  factura_item_id: z.string().uuid('Item inválido'),
  peso_kg: numero('Peso requerido', z.number().positive('El peso debe ser mayor a 0')),
  afecta_inventario: z.boolean(),
})

export const notaCreditoFormSchema = z.object({
  factura_id: z.string().uuid('Selecciona una factura'),
  fecha: z.string().regex(FECHA_REGEX, 'Fecha inválida'),
  motivo: z.string().min(1, 'El motivo es obligatorio'),
  items: z.array(notaCreditoItemFormSchema).min(1, 'Agrega al menos un item'),
})

export type NotaCreditoFormInput = z.input<typeof notaCreditoFormSchema>
export type NotaCreditoFormValues = z.output<typeof notaCreditoFormSchema>
export type NotaCreditoItemFormInput = z.input<typeof notaCreditoItemFormSchema>
