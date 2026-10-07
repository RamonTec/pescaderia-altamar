'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession } from '@/lib/services/authService'
import {
  activar,
  actualizarProveedor,
  bloquear,
  crearProveedor,
  desactivar,
  desbloquear,
  type ProveedorCreateInput,
} from '@/lib/services/proveedorService'
import { proveedorFormSchema, bloqueoSchema } from '@/lib/proveedorValidation'
import { toActionError, type ActionState } from '@/lib/actionState'

const MAPA_CAMPOS_RIF = { rif_ci: 'rif_ci' }

async function requireAuth(): Promise<boolean> {
  return !!(await getSession())
}

function fieldErrorsDeZod(
  error: z.ZodError
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

export interface UpsertProveedorState extends ActionState {
  id?: string | null
}

export async function upsertProveedorAction(
  _prev: UpsertProveedorState,
  formData: FormData
): Promise<UpsertProveedorState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }

  const id = (formData.get('id') as string) || null
  const raw = String(formData.get('payload') ?? '')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Datos inválidos', success: null }
  }

  const safe = proveedorFormSchema.safeParse(parsed)
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }

  const input = safe.data as unknown as ProveedorCreateInput

  try {
    if (id) {
      await actualizarProveedor(id, input)
    } else {
      const creado = await crearProveedor(input)
      revalidatePath('/proveedores')
      return { error: null, success: 'Proveedor creado', id: creado.id }
    }
  } catch (e) {
    const { error, fieldErrors } = toActionError(e, { mapaCampos: MAPA_CAMPOS_RIF })
    return { error, success: null, fieldErrors }
  }

  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor actualizado', id }
}

export async function desactivarProveedorAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  const parsed = z.string().uuid().safeParse(formData.get('id'))
  if (!parsed.success) return { error: 'Id inválido', success: null }
  try {
    await desactivar(parsed.data)
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor desactivado' }
}

export async function activarProveedorAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  const parsed = z.string().uuid().safeParse(formData.get('id'))
  if (!parsed.success) return { error: 'Id inválido', success: null }
  try {
    await activar(parsed.data)
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor activado' }
}

export async function bloquearProveedorAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  const idParsed = z.string().uuid().safeParse(formData.get('id'))
  if (!idParsed.success) return { error: 'Id inválido', success: null }

  const motivoParsed = bloqueoSchema.safeParse({ motivo: formData.get('motivo') })
  if (!motivoParsed.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(motivoParsed.error),
    }
  }

  try {
    await bloquear(idParsed.data, motivoParsed.data.motivo)
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor bloqueado' }
}

export async function desbloquearProveedorAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  const parsed = z.string().uuid().safeParse(formData.get('id'))
  if (!parsed.success) return { error: 'Id inválido', success: null }
  try {
    await desbloquear(parsed.data)
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor desbloqueado' }
}
