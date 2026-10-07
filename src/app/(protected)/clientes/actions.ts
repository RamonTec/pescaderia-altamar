'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/services/authService'
import {
  activar,
  actualizarCliente,
  bloquear,
  crearCliente,
  desactivar,
  desbloquear,
  type ClienteCreateInput,
} from '@/lib/services/clienteService'
import { toActionError } from '@/lib/actionState'

export interface ClienteActionState {
  error: string | null
  success: string | null
}

async function requireAuth(): Promise<boolean> {
  return !!(await getSession())
}

const SIN_SESION = 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.'

function toError(e: unknown): string {
  return toActionError(e).error
}

export async function upsertClienteAction(
  _prev: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }

  const id = (formData.get('id') as string) || null
  const raw = String(formData.get('payload') ?? '')
  let input: ClienteCreateInput
  try {
    input = JSON.parse(raw)
  } catch {
    return {
      error: 'Los datos del formulario llegaron incompletos. Recarga la página e intenta de nuevo.',
      success: null,
    }
  }

  try {
    if (id) {
      await actualizarCliente(id, input)
    } else {
      await crearCliente(input)
    }
  } catch (e) {
    return { error: toError(e), success: null }
  }

  revalidatePath('/clientes')
  return { error: null, success: id ? 'Cliente actualizado' : 'Cliente guardado' }
}

export async function desactivarClienteAction(
  _prev: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }
  const id = String(formData.get('id') ?? '')
  try {
    await desactivar(id)
  } catch (e) {
    return { error: toError(e), success: null }
  }
  revalidatePath('/clientes')
  return { error: null, success: 'Cliente desactivado' }
}

export async function activarClienteAction(
  _prev: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }
  const id = String(formData.get('id') ?? '')
  try {
    await activar(id)
  } catch (e) {
    return { error: toError(e), success: null }
  }
  revalidatePath('/clientes')
  return { error: null, success: 'Cliente activado' }
}

export async function bloquearClienteAction(
  _prev: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }
  const id = String(formData.get('id') ?? '')
  const motivo = String(formData.get('motivo') ?? '')
  try {
    await bloquear(id, motivo)
  } catch (e) {
    return { error: toError(e), success: null }
  }
  revalidatePath('/clientes')
  return { error: null, success: 'Cliente bloqueado' }
}

export async function desbloquearClienteAction(
  _prev: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  if (!(await requireAuth())) return { error: SIN_SESION, success: null }
  const id = String(formData.get('id') ?? '')
  try {
    await desbloquear(id)
  } catch (e) {
    return { error: toError(e), success: null }
  }
  revalidatePath('/clientes')
  return { error: null, success: 'Cliente desbloqueado' }
}
