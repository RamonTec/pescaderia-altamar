'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/services/authService'
import { editarCompra, EdicionCompraError } from '@/lib/services/edicionCompraService'
import { editarCompraSchema } from '@/lib/compraEdicionValidation'
import { tituloCompra } from '@/lib/compras/textos'
import { MSG_TASA_REFERENCIAL_CAMBIO } from '@/lib/validationMessages'
import { toActionError } from '@/lib/actionState'
import type { EdicionCompraActionState } from '@/components/organisms/EditarCompraDialog'

/** Server Actions de la ficha de compra (19, solo admin): edición de la compra. */

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

export async function editarCompraAction(payload: unknown): Promise<EdicionCompraActionState> {
  if (!(await requireAdmin())) {
    return { error: 'Solo un administrador puede editar compras', success: null }
  }
  const safe = editarCompraSchema.safeParse(payload)
  if (!safe.success) {
    return { error: 'Revisa los campos marcados', success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  }

  let aviso: 'referencial_cambio' | undefined
  try {
    aviso = (await editarCompra(safe.data)).aviso
  } catch (e) {
    if (e instanceof EdicionCompraError) {
      return { error: e.message, success: null, fieldErrors: e.campo ? { [e.campo]: e.message } : undefined }
    }
    const { error, fieldErrors } = toActionError(e)
    return { error, success: null, fieldErrors }
  }

  revalidatePath('/compras')
  revalidatePath(`/compras/${safe.data.compra_id}`)
  revalidatePath('/proveedores/[id]', 'page')
  revalidatePath('/inventario', 'layout')
  revalidatePath('/procesamiento')
  revalidatePath('/contratos')
  revalidatePath('/facturas/[id]', 'page')
  revalidatePath('/')
  return {
    error: null,
    success: `${tituloCompra(safe.data.fecha)} actualizada`,
    info: aviso === 'referencial_cambio' ? MSG_TASA_REFERENCIAL_CAMBIO : null,
  }
}
