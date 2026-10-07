import { z } from 'zod'
import { MSG_EMAIL_INVALIDO } from './validationMessages'

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
  // 07-lotes: un lote abierto con más días que estos se marca "antiguo".
  dias_alerta_lote: z
    .number()
    .int('Usa un número entero de días')
    .min(1, 'Mínimo 1 día')
    .max(365, 'Máximo 365 días')
    .nullable(),
  umbral_desviacion_tasa_pct: z
    .number({ message: 'Umbral requerido' })
    .min(0, 'El umbral no puede ser negativo')
    .max(100, 'El umbral no puede superar 100%'),
  // 09-cuentas-por-cobrar: vencimientos y datos de los recordatorios de cobro.
  dias_credito_default: z
    .number({ message: 'Días requeridos' })
    .int('Usa un número entero de días')
    .min(0, 'No puede ser negativo')
    .max(365, 'Máximo 365 días'),
  dias_aviso_por_vencer: z
    .number({ message: 'Días requeridos' })
    .int('Usa un número entero de días')
    .min(0, 'No puede ser negativo')
    .max(60, 'Máximo 60 días'),
  nombre_comercial: z.string().trim().min(1, 'Nombre comercial requerido').max(120, 'Máximo 120 caracteres'),
  email_respuesta: z.string().trim().email(MSG_EMAIL_INVALIDO).or(z.literal('')),
  instrucciones_pago: z.string().max(1500, 'Máximo 1500 caracteres'),
})

export type ConfigFormValues = z.infer<typeof configFormSchema>
