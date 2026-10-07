import { z } from 'zod'

/**
 * Validación de pedidos y venta directa (05-ventas).
 * Un solo formulario con toggle `entrega_inmediata`: si es `false` es un
 * pedido agendado (fecha de entrega + peso estimado); si es `true` es venta
 * directa/POS (peso real → factura al guardar).
 */

function numero(mensajeRequerido: string, base: z.ZodNumber = z.number()) {
  return base
    .nullable()
    .refine((v) => v !== null, mensajeRequerido)
    .transform((v) => v as number)
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const pedidoItemFormSchema = z.object({
  producto_id: z.string().uuid('Selecciona un producto'),
  peso_kg: numero('Peso requerido', z.number().positive('El peso debe ser mayor a 0')),
  precio_usd_kg: numero('Precio requerido', z.number().min(0, 'El precio no puede ser negativo')),
})

export const pedidoFormSchema = z
  .object({
    cliente_id: z.string().uuid('Selecciona un cliente'),
    entrega_inmediata: z.boolean(),
    fecha: z.string().regex(FECHA_REGEX, 'Fecha inválida'),
    fecha_entrega: z
      .string()
      .nullable()
      .transform((v) => (v ? v : null)),
    condicion: z.enum(['contado', 'credito']),
    notas: z.string(),
    items: z.array(pedidoItemFormSchema).min(1, 'Agrega al menos un producto'),
  })
  .superRefine((v, ctx) => {
    if (!v.entrega_inmediata && !v.fecha_entrega) {
      ctx.addIssue({
        code: 'custom',
        path: ['fecha_entrega'],
        message: 'Un pedido agendado requiere fecha de entrega',
      })
    }
  })

export type PedidoFormInput = z.input<typeof pedidoFormSchema>
export type PedidoFormValues = z.output<typeof pedidoFormSchema>
export type PedidoItemFormInput = z.input<typeof pedidoItemFormSchema>

export const entregaPedidoSchema = z.object({
  pedido_id: z.string().uuid(),
  fecha: z.string().regex(FECHA_REGEX, 'Fecha inválida'),
  condicion: z.enum(['contado', 'credito']),
  pesos_reales: z
    .array(
      z.object({
        pedido_item_id: z.string().uuid(),
        peso_kg: numero('Peso requerido', z.number().positive('El peso debe ser mayor a 0')),
      })
    )
    .min(1, 'Captura el peso real de al menos un item'),
})

export type EntregaPedidoInput = z.input<typeof entregaPedidoSchema>
export type EntregaPedidoValues = z.output<typeof entregaPedidoSchema>
