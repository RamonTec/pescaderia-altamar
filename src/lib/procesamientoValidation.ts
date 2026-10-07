import { z } from 'zod'

/**
 * Validación de una línea de procesamiento (04-inventario, /SPEC.md §4.3):
 * se procesa un lote crudo elegido por el operador (07-lotes).
 * Igual que en compras: los pesos aceptan `null` de entrada (`NumberField`
 * vacío) y salen como `number`.
 */

function peso(mensajeRequerido: string) {
  return z
    .number()
    .positive('El peso debe ser mayor a 0')
    .nullable()
    .refine((v) => v !== null, mensajeRequerido)
    .transform((v) => v as number)
}

export const procesamientoFormSchema = z
  .object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    producto_origen_id: z.string().uuid('Selecciona el producto crudo'),
    /** Lote crudo del que se saca (07-lotes): un lote crudo da un lote procesado. */
    lote_origen_id: z.string().uuid('Elige el lote de origen'),
    peso_entrada_kg: peso('Peso de entrada requerido'),
    producto_destino_id: z.string().uuid('Selecciona el producto procesado'),
    peso_salida_kg: peso('Peso de salida requerido'),
    notas: z.string(),
  })
  .superRefine((v, ctx) => {
    // Mismo límite que el constraint `salida_menor_entrada` (0001).
    if (v.peso_salida_kg > v.peso_entrada_kg) {
      ctx.addIssue({
        code: 'custom',
        path: ['peso_salida_kg'],
        message: 'El peso de salida no puede superar al de entrada',
      })
    }
  })

export type ProcesamientoFormInput = z.input<typeof procesamientoFormSchema>
export type ProcesamientoFormValues = z.output<typeof procesamientoFormSchema>
