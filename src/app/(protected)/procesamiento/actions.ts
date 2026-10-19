'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/services/authService'
import { ProcesamientoError, crearProcesamiento } from '@/lib/services/procesamientoService'
import { procesamientoFormSchema } from '@/lib/procesamientoValidation'
import { toActionError, type ActionState } from '@/lib/actionState'
import type { LoteCreado } from '@/types/domain'

/** Resultado de registrar un procesamiento: los N lotes creados, para rotular (16). */
export interface ProcesamientoActionState extends ActionState {
  lotes?: LoteCreado[]
}

function errorDeDominio(e: unknown): ActionState {
  if (e instanceof ProcesamientoError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }
  // Los errores de la RPC ya llegan como `ProcesamientoError` con su campo
  // (`salidas.N.*`): los traduce `procesamientoService`.

  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

export async function crearProcesamientoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ProcesamientoActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }

  let payload: unknown = null
  try {
    payload = JSON.parse(String(formData.get('payload') ?? ''))
  } catch {
    // payload inválido: lo rechaza el schema
  }

  const safe = procesamientoFormSchema.safeParse(payload)
  if (!safe.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of safe.error.issues) {
      const path = issue.path.join('.')
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message
    }
    return { error: 'Revisa los campos marcados', success: null, fieldErrors }
  }

  let lotes: LoteCreado[]
  try {
    ;({ lotes } = await crearProcesamiento(safe.data))
  } catch (e) {
    return errorDeDominio(e)
  }

  revalidatePath('/procesamiento')
  revalidatePath('/inventario', 'layout')
  return { error: null, success: 'Procesamiento registrado', lotes }
}
