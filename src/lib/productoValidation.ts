import { z } from 'zod'
import { MSG_NOMBRE_REQUERIDO } from './validationMessages'

/**
 * Validación del catálogo de productos (04-inventario).
 * El código es opcional pero, si se envía, se normaliza en mayúsculas.
 * Un procesado indica de qué crudo se obtiene (0014); en un crudo se ignora.
 */
export const productoFormSchema = z
  .object({
    nombre: z.string().trim().min(1, MSG_NOMBRE_REQUERIDO),
    tipo: z.enum(['crudo', 'procesado']),
    categoria: z.string(),
    codigo: z.string(),
    controla_stock: z.boolean(),
    producto_origen_id: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'procesado' && !z.string().uuid().safeParse(v.producto_origen_id).success) {
      ctx.addIssue({
        code: 'custom',
        path: ['producto_origen_id'],
        message: 'Indica de qué producto crudo se obtiene',
      })
    }
  })

export type ProductoFormValues = z.infer<typeof productoFormSchema>
