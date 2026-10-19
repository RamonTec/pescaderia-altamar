import { z } from 'zod'
import type { Producto } from '@/types/domain'

/**
 * Validación de un procesamiento multisalida (16, /SPEC.md §4.3): un lote
 * crudo + un peso de entrada → 1 a 10 salidas de procesados distintos.
 * Igual que en compras: los pesos aceptan `null` de entrada (`NumberField`
 * vacío) y salen como `number`.
 *
 * El precio de referencia de una salida depende del catálogo (si el
 * procesado ya tiene precio, se usa ese), así que no lo exige el esquema:
 * lo revisa `validarPreciosSalidas`, que usan la UI y el servicio.
 */

export const MAX_SALIDAS = 10

/** Tolerancia de redondeo de numeric(12,3). */
const TOLERANCIA_KG = 0.0005

function peso(mensajeRequerido: string) {
  return z
    .number()
    .positive('El peso debe ser mayor a 0')
    .nullable()
    .refine((v) => v !== null, mensajeRequerido)
    .transform((v) => v as number)
}

export const salidaProcesoSchema = z.object({
  producto_destino_id: z.string().uuid('Selecciona el producto procesado'),
  peso_salida_kg: peso('Peso de salida requerido'),
  /** USD/kg. `null` = sin precio en el formulario (se usa el del catálogo). */
  precio_referencia_usd_kg: z.number().min(0, 'El precio no puede ser negativo').nullable(),
})

export const procesamientoFormSchema = z
  .object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    producto_origen_id: z.string().uuid('Selecciona el producto crudo'),
    /** Lote crudo del que se saca (07-lotes): un procesamiento, un lote. */
    lote_origen_id: z.string().uuid('Elige el lote de origen'),
    peso_entrada_kg: peso('Peso de entrada requerido'),
    salidas: z
      .array(salidaProcesoSchema)
      .min(1, 'Agrega al menos una salida')
      .max(MAX_SALIDAS, `Como máximo ${MAX_SALIDAS} salidas`),
    notas: z.string(),
  })
  .superRefine((v, ctx) => {
    // Una salida por producto (índice único en la base).
    const vistos = new Set<string>()
    v.salidas.forEach((s, i) => {
      if (!s.producto_destino_id) return
      if (vistos.has(s.producto_destino_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['salidas', i, 'producto_destino_id'],
          message: 'Este producto ya está en otra salida',
        })
      }
      vistos.add(s.producto_destino_id)
    })

    // Σ salidas ≤ entrada (merma del proceso completo).
    const total = sumaSalidasKg(v.salidas)
    if (v.peso_entrada_kg != null && total > v.peso_entrada_kg + TOLERANCIA_KG) {
      ctx.addIssue({
        code: 'custom',
        path: ['salidas'],
        message: 'La suma de las salidas no puede superar el peso de entrada',
      })
    }
  })

export type ProcesamientoFormInput = z.input<typeof procesamientoFormSchema>
export type ProcesamientoFormValues = z.output<typeof procesamientoFormSchema>
export type SalidaProcesoValues = z.output<typeof salidaProcesoSchema>

/** Σ kg de las salidas (redondeo a milésimas). */
export function sumaSalidasKg(salidas: { peso_salida_kg: number | null }[]): number {
  const mil = salidas.reduce((s, x) => s + Math.round((x.peso_salida_kg ?? 0) * 1000), 0)
  return mil / 1000
}

/**
 * Precio que usará cada salida: el del catálogo si existe (manda siempre),
 * si no el del formulario. Mismo criterio que la RPC.
 */
export function precioEfectivo(
  salida: { producto_destino_id: string; precio_referencia_usd_kg: number | null },
  procesados: Pick<Producto, 'id' | 'precio_referencia_usd_kg'>[]
): { precio: number | null; delCatalogo: boolean } {
  const catalogo = procesados.find((p) => p.id === salida.producto_destino_id)
  const precioCatalogo = catalogo?.precio_referencia_usd_kg ?? null
  if (precioCatalogo != null) return { precio: Number(precioCatalogo), delCatalogo: true }
  return { precio: salida.precio_referencia_usd_kg, delCatalogo: false }
}

/**
 * Con ≥ 2 salidas toda salida necesita precio de referencia: la que no lo
 * tiene en el catálogo debe traerlo en el formulario. Con una sola salida no
 * hace falta (recibe el 100 % del costo). Devuelve los errores por índice.
 */
export function validarPreciosSalidas(
  salidas: { producto_destino_id: string; precio_referencia_usd_kg: number | null }[],
  procesados: Pick<Producto, 'id' | 'precio_referencia_usd_kg'>[]
): Record<number, string> {
  const errores: Record<number, string> = {}
  if (salidas.length < 2) return errores
  salidas.forEach((s, i) => {
    if (!s.producto_destino_id) return
    const { precio } = precioEfectivo(s, procesados)
    if (precio == null) errores[i] = 'Indica el precio de referencia'
    else if (precio < 0) errores[i] = 'El precio no puede ser negativo'
  })
  return errores
}
