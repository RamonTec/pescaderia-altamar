import { z } from 'zod'

/**
 * Validación de las Server Actions de recordatorios de cobro
 * (09-cuentas-por-cobrar). El servidor vuelve a verificar rol, pertenencia y
 * saldo de cada factura en `recordatorioService`.
 */

const facturaIds = z
  .array(z.string().uuid())
  .min(1, 'Selecciona al menos una factura pendiente o vencida')
  .max(200, 'Demasiadas facturas en un solo recordatorio')

export const prepararRecordatorioSchema = z.object({
  clienteId: z.string().uuid('Cliente inválido'),
  facturaIds: z.array(z.string().uuid()).optional(),
})

export const recordatorioWhatsappSchema = z.object({
  clienteId: z.string().uuid('Cliente inválido'),
  facturaIds,
  texto: z.string().trim().min(1, 'El mensaje no puede quedar vacío').max(4000, 'Mensaje demasiado largo'),
})

export const recordatorioCorreoSchema = recordatorioWhatsappSchema.extend({
  asunto: z.string().trim().min(1, 'El asunto es obligatorio').max(200, 'Asunto demasiado largo'),
  texto: z.string().trim().min(1, 'El mensaje no puede quedar vacío').max(20000, 'Mensaje demasiado largo'),
})

export const reintentarRecordatorioSchema = z.object({
  recordatorioId: z.string().uuid('Recordatorio inválido'),
})

export type PrepararRecordatorioInput = z.infer<typeof prepararRecordatorioSchema>
export type RecordatorioWhatsappInput = z.infer<typeof recordatorioWhatsappSchema>
export type RecordatorioCorreoInput = z.infer<typeof recordatorioCorreoSchema>
