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
  AccionNoAutorizadaError,
  ClienteValidationError,
  type ClienteCreateInput,
} from '@/lib/services/clienteService'

export interface ClienteActionState {
  error: string | null
  success: string | null
}

async function requireAuth(): Promise<boolean> {
  return !!(await getSession())
}

function toError(e: unknown): string {
  if (e instanceof ClienteValidationError) return e.message
  if (e instanceof AccionNoAutorizadaError) return e.message
  if (e instanceof Error) {
    // Los errores de PostgREST traen code/details/hint que `message` esconde.
    const pg = e as Error & { code?: string; details?: string; hint?: string }
    console.error('[clientes] error:', {
      message: pg.message,
      code: pg.code,
      details: pg.details,
      hint: pg.hint,
    })
    if (pg.hint) return `${pg.message} (${pg.hint})`
    if (pg.code) return `${pg.message} [${pg.code}]`
    return pg.message
  }
  return 'Ocurrió un error inesperado'
}

export async function upsertClienteAction(
  _prev: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }

  const id = (formData.get('id') as string) || null
  const raw = String(formData.get('payload') ?? '')
  let input: ClienteCreateInput
  try {
    input = JSON.parse(raw)
  } catch {
    return { error: 'Datos inválidos', success: null }
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
  return { error: null, success: id ? 'Cliente actualizado' : 'Cliente creado' }
}

export async function desactivarClienteAction(
  _prev: ClienteActionState,
  formData: FormData
): Promise<ClienteActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
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
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
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
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
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
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  const id = String(formData.get('id') ?? '')
  try {
    await desbloquear(id)
  } catch (e) {
    return { error: toError(e), success: null }
  }
  revalidatePath('/clientes')
  return { error: null, success: 'Cliente desbloqueado' }
}
