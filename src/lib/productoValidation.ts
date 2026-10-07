import { z } from 'zod'
import { MSG_NOMBRE_REQUERIDO } from './validationMessages'

/**
 * Validación del catálogo de productos (04-inventario).
 * El código es opcional pero, si se envía, se normaliza en mayúsculas.
 */
export const productoFormSchema = z.object({
  nombre: z.string().trim().min(1, MSG_NOMBRE_REQUERIDO),
  tipo: z.enum(['crudo', 'procesado']),
  categoria: z.string(),
  codigo: z.string(),
  controla_stock: z.boolean(),
})

export type ProductoFormValues = z.infer<typeof productoFormSchema>
