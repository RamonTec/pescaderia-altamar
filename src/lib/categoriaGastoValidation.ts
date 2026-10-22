import { z } from 'zod'
import { MSG_CATEGORIA_NOMBRE, MSG_CATEGORIA_ORDEN } from './validationMessages'

/**
 * Validación del catálogo de categorías de gasto (20-gastos): nombre 2–60,
 * padre opcional (subcategoría de un nivel; la base lo hace cumplir con
 * `categorias_gasto_guard`) y orden de presentación.
 */
export const categoriaGastoSchema = z.object({
  /** Vacío al crear. */
  id: z.string().uuid().or(z.literal('')),
  nombre: z.string().trim().min(2, MSG_CATEGORIA_NOMBRE).max(60, MSG_CATEGORIA_NOMBRE),
  /** `''` = categoría de primer nivel. */
  categoria_padre_id: z.string().uuid().or(z.literal('')),
  orden: z
    .number()
    .int(MSG_CATEGORIA_ORDEN)
    .min(0, MSG_CATEGORIA_ORDEN)
    .max(999, MSG_CATEGORIA_ORDEN)
    .nullable()
    .transform((v) => v ?? 0),
})

export type CategoriaGastoFormInput = z.input<typeof categoriaGastoSchema>
export type CategoriaGastoFormValues = z.output<typeof categoriaGastoSchema>

export const activarCategoriaGastoSchema = z.object({
  id: z.string().uuid(),
  activo: z.boolean(),
})

export type ActivarCategoriaGastoValues = z.output<typeof activarCategoriaGastoSchema>
