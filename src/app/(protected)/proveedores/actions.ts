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

const SIN_SESION = 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.'

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

/**
 * Estado de `upsertProveedorAction`: además de error/success lleva
 * `fieldErrors` para que el Stepper salte al paso del campo que falló
 * (la Server Action corre `proveedorFormSchema.safeParse`, 03-proveedores).
 */
export interface UpsertProveedorState extends ActionState {
  id?: string | null
}

export async function upsertProveedorAction(
  _prev: UpsertProveedorState,
  formData: FormData
): Promise<UpsertProveedorState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }

  const id = (formData.get('id') as string) || null
  const raw = String(formData.get('payload') ?? '')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      error: 'Los datos del formulario llegaron incompletos. Recarga la página e intenta de nuevo.',
      success: null,
    }
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
      return { error: null, success: 'Proveedor guardado', id: creado.id }
    }
  } catch (e) {
    const { error, fieldErrors } = toActionError(e, { mapaCampos: MAPA_CAMPOS_RIF })
    return { error, success: null, fieldErrors }
  }

  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor actualizado', id }
}

/** Estado simple de las acciones de fila (desactivar/activar/bloquear/desbloquear). */
export interface ProveedorActionState {
  error: string | null
  success: string | null
}

export async function desactivarProveedorAction(
  _prev: ProveedorActionState,
  formData: FormData
): Promise<ProveedorActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }
  const id = String(formData.get('id') ?? '')
  try {
    await desactivar(id)
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor desactivado' }
}

export async function activarProveedorAction(
  _prev: ProveedorActionState,
  formData: FormData
): Promise<ProveedorActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }
  const id = String(formData.get('id') ?? '')
  try {
    await activar(id)
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor activado' }
}

export async function bloquearProveedorAction(
  _prev: ProveedorActionState,
  formData: FormData
): Promise<ProveedorActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }
  const id = String(formData.get('id') ?? '')
  const motivo = String(formData.get('motivo') ?? '')

  const motivoParsed = bloqueoSchema.safeParse({ motivo })
  if (!motivoParsed.success) {
    return { error: motivoParsed.error.issues[0]?.message ?? 'Motivo inválido', success: null }
  }

  try {
    await bloquear(id, motivoParsed.data.motivo)
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor bloqueado' }
}

export async function desbloquearProveedorAction(
  _prev: ProveedorActionState,
  formData: FormData
): Promise<ProveedorActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }
  const id = String(formData.get('id') ?? '')
  try {
    await desbloquear(id)
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/proveedores')
  return { error: null, success: 'Proveedor desbloqueado' }
}