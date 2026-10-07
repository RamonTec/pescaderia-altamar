import { z } from 'zod'

/**
 * Validación de lotes (07-lotes): pérdidas, cierre y asignación de lotes en
 * una línea de venta. Los pesos aceptan `null` de entrada (`NumberField`
 * vacío) y salen como `number`.
 */

/** Tolerancia de redondeo de numeric(12,3). */
export const TOLERANCIA_KG = 0.0005

export const MOTIVOS_PERDIDA = ['danado', 'vencido', 'faltante', 'otro'] as const

export const ETIQUETA_MOTIVO: Record<(typeof MOTIVOS_PERDIDA)[number] | 'cierre', string> = {
  danado: 'Dañado',
  vencido: 'Vencido',
  faltante: 'Faltante',
  otro: 'Otro',
  cierre: 'Cierre de lote',
}

export const perdidaLoteFormSchema = z
  .object({
    lote_id: z.string().uuid('Lote inválido'),
    peso_kg: z
      .number()
      .positive('El peso debe ser mayor a 0')
      .nullable()
      .refine((v) => v !== null, 'Peso requerido')
      .transform((v) => v as number),
    motivo: z.enum(MOTIVOS_PERDIDA, { message: 'Elige el motivo' }),
    detalle: z.string().max(300, 'Máximo 300 caracteres'),
  })
  .superRefine((v, ctx) => {
    if (v.motivo === 'otro' && !v.detalle.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['detalle'],
        message: 'Describe qué pasó',
      })
    }
  })

export type PerdidaLoteFormInput = z.input<typeof perdidaLoteFormSchema>
export type PerdidaLoteFormValues = z.output<typeof perdidaLoteFormSchema>

export const cerrarLoteSchema = z.object({
  lote_id: z.string().uuid('Lote inválido'),
  /** Kg que el usuario confirmó dar de baja; si el stock cambió, la base rechaza. */
  peso_esperado_kg: z.number().min(0),
  detalle: z.string().max(300, 'Máximo 300 caracteres'),
})

export type CerrarLoteValues = z.output<typeof cerrarLoteSchema>

/** Kg asignados a un lote en una línea de venta (sin costos). */
export const asignacionLoteSchema = z.object({
  lote_id: z.string().uuid(),
  codigo: z.string(),
  peso_kg: z.number().min(0, 'No puede ser negativo'),
  disponible_kg: z.number(),
  fecha_ingreso: z.string(),
})

export const asignacionesLoteSchema = z.array(asignacionLoteSchema)

/** Suma de una asignación, redondeada a gramos. */
export function sumaAsignacion(asignaciones: ReadonlyArray<{ peso_kg: number }>): number {
  return Math.round(asignaciones.reduce((s, a) => s + (a.peso_kg || 0), 0) * 1000) / 1000
}

/**
 * Valida que la asignación de una línea cuadre con su peso y no exceda el
 * disponible de cada lote. Para `.superRefine` de los formularios de venta:
 * `path` es la ruta del campo `asignaciones` de la línea.
 */
export function validarAsignacion(
  asignaciones: ReadonlyArray<{ peso_kg: number; disponible_kg: number; codigo: string }>,
  pesoKg: number,
  ctx: z.RefinementCtx,
  path: (string | number)[]
): void {
  if (asignaciones.length === 0) return
  const suma = sumaAsignacion(asignaciones)
  if (Math.abs(suma - pesoKg) > TOLERANCIA_KG) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Los lotes suman ${suma.toFixed(3)} kg y la línea pesa ${pesoKg.toFixed(3)} kg`,
    })
  }
  for (const a of asignaciones) {
    if (a.peso_kg > a.disponible_kg + TOLERANCIA_KG) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: `El lote ${a.codigo} solo tiene ${a.disponible_kg.toFixed(3)} kg`,
      })
      break
    }
  }
}
