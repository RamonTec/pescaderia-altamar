import { z } from 'zod'

/**
 * Validación de la configuración del negocio (04-inventario, 08-tasas).
 * IVA en porcentaje (0–100), fuente de tasa preferida, umbral de stock bajo
 * y umbral de desviación % de una tasa manual (08-tasas).
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
  umbral_desviacion_tasa_pct: z
    .number({ message: 'Umbral requerido' })
    .min(0, 'El umbral no puede ser negativo')
    .max(100, 'El umbral no puede superar 100%'),
})

export type ConfigFormValues = z.infer<typeof configFormSchema>
