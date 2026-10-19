'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/services/authService'
import { corregirLinea, CorreccionFacturaError } from '@/lib/services/correccionFacturaService'
import { LimiteCreditoExcedido } from '@/lib/services/invoiceService'
import { lotesAbiertosDe } from '@/lib/services/loteService'
import { corregirLineaSchema } from '@/lib/correccionFacturaValidation'
import { numeroFactura } from '@/lib/repositories/carteraRepository'
import { toActionError } from '@/lib/actionState'
import type { CorreccionActionState } from '@/components/organisms/CorregirLineaFacturaDialog'

/**
 * Server Actions de la ficha de factura (17, solo admin): corrección de una
 * línea y stock disponible para el aviso previo del diálogo.
 */

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

export async function corregirLineaFacturaAction(
  payload: unknown,
  numero: number
): Promise<CorreccionActionState> {
  if (!(await requireAdmin())) {
    return { error: 'Solo un administrador puede corregir facturas', success: null }
  }
  const safe = corregirLineaSchema.safeParse(payload)
  if (!safe.success) {
    return { error: 'Revisa los campos marcados', success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  }

  try {
    await corregirLinea(safe.data)
  } catch (e) {
    if (e instanceof LimiteCreditoExcedido) return { error: null, success: null, advertenciaLimite: e.advertencia }
    if (e instanceof CorreccionFacturaError) {
      return { error: e.message, success: null, fieldErrors: e.campo ? { [e.campo]: e.message } : undefined }
    }
    const { error, fieldErrors } = toActionError(e)
    return { error, success: null, fieldErrors }
  }

  revalidatePath(`/facturas/${safe.data.factura_id}`)
  revalidatePath('/cobros')
  revalidatePath('/clientes/[id]', 'page')
  revalidatePath('/inventario')
  revalidatePath('/inventario/lotes/[id]', 'page')
  revalidatePath('/contratos')
  return { error: null, success: `Factura ${numeroFactura(numero)} corregida` }
}

const uuid = z.string().uuid()

/** Kg en lotes abiertos de un producto (aviso previo de stock; valida la RPC). */
export async function disponibleProductoAction(productoId: string): Promise<number | null> {
  if (!(await requireAdmin()) || !uuid.safeParse(productoId).success) return null
  try {
    const lotes = await lotesAbiertosDe(productoId)
    return Math.round(lotes.reduce((s, l) => s + Number(l.stock_kg), 0) * 1000) / 1000
  } catch {
    return null
  }
}
