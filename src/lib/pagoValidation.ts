import { z } from 'zod'

/**
 * Validación de cobros/abonos a facturas (05-ventas).
 * Misma estructura que `pagoProveedorFormSchema` (04-inventario).
 */

function numero(mensajeRequerido: string, base: z.ZodNumber = z.number()) {
  return base
    .nullable()
    .refine((v) => v !== null, mensajeRequerido)
    .transform((v) => v as number)
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const METODOS_POR_MONEDA = {
  usd: ['efectivo_usd', 'zelle', 'transferencia'],
  bs: ['efectivo_bs', 'pago_movil', 'transferencia', 'punto'],
} as const

export const pagoFormSchema = z
  .object({
    factura_id: z.string().uuid(),
    fecha: z.string().regex(FECHA_REGEX, 'Fecha inválida'),
    moneda_pago: z.enum(['usd', 'bs']),
    metodo: z.enum(['efectivo_usd', 'efectivo_bs', 'pago_movil', 'zelle', 'transferencia', 'punto']),
    monto: numero('Monto requerido', z.number().positive('El monto debe ser mayor a 0')),
    tasa_pago: numero('Tasa requerida', z.number().positive('La tasa debe ser mayor a 0')),
  })
  .superRefine((v, ctx) => {
    const permitidos: readonly string[] = METODOS_POR_MONEDA[v.moneda_pago]
    if (!permitidos.includes(v.metodo)) {
      ctx.addIssue({
        code: 'custom',
        path: ['metodo'],
        message: 'Método no válido para esta moneda',
      })
    }
  })

export type PagoFormInput = z.input<typeof pagoFormSchema>
export type PagoFormValues = z.output<typeof pagoFormSchema>
