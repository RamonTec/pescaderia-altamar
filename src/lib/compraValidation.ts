import { z } from 'zod'

/**
 * Validación de compras y pagos a proveedores (04-inventario).
 *
 * Los campos numéricos aceptan `null` como entrada (es lo que emite
 * `NumberField` con el campo vacío) y salen como `number`: el formulario usa
 * `z.input` y la Server Action recibe `z.output`.
 */

function numero(mensajeRequerido: string, base: z.ZodNumber = z.number()) {
  return base
    .nullable()
    .refine((v) => v !== null, mensajeRequerido)
    .transform((v) => v as number)
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const compraItemFormSchema = z.object({
  producto_id: z.string().uuid('Selecciona un producto'),
  peso_kg: numero('Peso requerido', z.number().positive('El peso debe ser mayor a 0')),
  /** Costo por kg en la moneda de la compra (USD o Bs). */
  costo_kg: numero('Costo requerido', z.number().min(0, 'El costo no puede ser negativo')),
})

export const compraFormSchema = z.object({
  proveedor_id: z.string().uuid('Selecciona un proveedor'),
  fecha: z.string().regex(FECHA_REGEX, 'Fecha inválida'),
  condicion: z.enum(['contado', 'credito']),
  moneda: z.enum(['usd', 'bs']),
  tasa: numero('Tasa requerida', z.number().positive('La tasa debe ser mayor a 0')),
  notas: z.string(),
  items: z.array(compraItemFormSchema).min(1, 'Agrega al menos un producto'),
})

export type CompraFormInput = z.input<typeof compraFormSchema>
export type CompraFormValues = z.output<typeof compraFormSchema>
export type CompraItemFormInput = z.input<typeof compraItemFormSchema>

/** Métodos que admite cada moneda de pago. */
export const METODOS_POR_MONEDA = {
  usd: ['efectivo_usd', 'zelle', 'transferencia'],
  bs: ['efectivo_bs', 'pago_movil', 'transferencia', 'punto'],
} as const

export const pagoProveedorFormSchema = z
  .object({
    compra_id: z.string().uuid(),
    fecha: z.string().regex(FECHA_REGEX, 'Fecha inválida'),
    moneda_pago: z.enum(['usd', 'bs']),
    metodo: z.enum(['efectivo_usd', 'efectivo_bs', 'pago_movil', 'zelle', 'transferencia', 'punto']),
    /** Monto en la moneda del pago. */
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

export type PagoProveedorFormInput = z.input<typeof pagoProveedorFormSchema>
export type PagoProveedorFormValues = z.output<typeof pagoProveedorFormSchema>
