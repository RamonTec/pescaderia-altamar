'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/services/authService'
import { ProcesamientoError, crearProcesamiento } from '@/lib/services/procesamientoService'
import { procesamientoFormSchema } from '@/lib/procesamientoValidation'
import { toActionError, type ActionState } from '@/lib/actionState'
import type { LoteCreado } from '@/types/domain'

/** Resultado de registrar un procesamiento: el lote procesado creado (07-lotes). */
export interface ProcesamientoActionState extends ActionState {
  lotes?: LoteCreado[]
}

interface PostgresErrorLike {
  code?: string
  hint?: string
  message?: string
}

function errorDeDominio(e: unknown): ActionState {
  if (e instanceof ProcesamientoError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }

  // Reglas que la base repite (0001 / registrar_procesamiento) por si el
  // servicio se salta; el stock se valida contra el lote, bajo lock.
  const pg = (e ?? {}) as PostgresErrorLike
  if (pg.code === '23514' && pg.message?.includes('salida_menor_entrada')) {
    const mensaje = 'El peso de salida no puede superar al de entrada'
    return { error: mensaje, success: null, fieldErrors: { peso_salida_kg: mensaje } }
  }
  if (pg.code === 'P0001' && pg.hint === 'stock_insuficiente' && pg.message) {
    return { error: pg.message, success: null, fieldErrors: { peso_entrada_kg: pg.message } }
  }
  if (pg.code === 'P0001' && pg.hint === 'lote_no_disponible' && pg.message) {
    return { error: pg.message, success: null, fieldErrors: { lote_origen_id: pg.message } }
  }
  if (pg.code === 'P0001' && pg.hint === 'destino_no_corresponde' && pg.message) {
    return { error: pg.message, success: null, fieldErrors: { producto_destino_id: pg.message } }
  }

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
