'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession, getRol } from '@/lib/services/authService'
import { emitirNotaCredito, anularNotaCredito, NotaCreditoError } from '@/lib/services/notaCreditoService'
import { notaCreditoFormSchema } from '@/lib/notaCreditoValidation'
import { toActionError, type ActionState } from '@/lib/actionState'

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

function leerPayload(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get('payload') ?? ''))
  } catch {
    return null
  }
}

function errorDeDominio(e: unknown): ActionState {
  if (e instanceof NotaCreditoError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

export async function emitirNotaCreditoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if ((await getRol()) !== 'admin') {
    return { error: 'Solo un administrador puede emitir notas de crédito', success: null }
  }

  const safe = notaCreditoFormSchema.safeParse(leerPayload(formData))
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }

  const v = safe.data
  try {
    await emitirNotaCredito({
      factura_id: v.factura_id,
      motivo: v.motivo,
      fecha: v.fecha,
      items: v.items.map((i) => ({
        factura_item_id: i.factura_item_id,
        peso_kg: i.peso_kg,
        afecta_inventario: i.afecta_inventario,
      })),
    })
  } catch (e) {
    return errorDeDominio(e)
  }

  revalidatePath('/notas-credito')
  revalidatePath('/cobros')
  revalidatePath('/clientes', 'layout')
  return { error: null, success: 'Nota de crédito emitida' }
}

export async function anularNotaCreditoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if ((await getRol()) !== 'admin') {
    return { error: 'Solo un administrador puede anular notas de crédito', success: null }
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Nota no encontrada', success: null }

  try {
    await anularNotaCredito(id)
  } catch (e) {
    return errorDeDominio(e)
  }

  revalidatePath('/notas-credito')
  revalidatePath('/cobros')
  revalidatePath('/clientes', 'layout')
  return { error: null, success: 'Nota de crédito anulada' }
}
