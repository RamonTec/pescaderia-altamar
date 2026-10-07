import { z } from 'zod'

/**
 * Validación de la configuración del negocio (04-inventario).
 * IVA en porcentaje (0–100), fuente de tasa preferida y umbral de stock bajo.
 */
export const configFormSchema = z.object({
  iva_pct: z
    .number({ message: 'IVA requerido' })
    .min(0, 'El IVA no puede ser negativo')
    .max(100, 'El IVA no puede superar 100%'),
  fuente_tasa_default: z.enum(['bcv', 'paralela']),
  umbral_stock_bajo_kg: z
    .number()
    .min(0, 'El umbral no puede ser negativo')
    .nullable(),
})

export type ConfigFormValues = z.infer<typeof configFormSchema>
