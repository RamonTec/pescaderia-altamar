'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { getSession, getRol } from '@/lib/services/authService'
import {
  enviarCorreo,
  prepararRecordatorio,
  registrarRecordatorio,
  reintentarCorreo,
  RecordatorioError,
  type PreparacionRecordatorio,
  type ResultadoRecordatorio,
} from '@/lib/services/recordatorioService'
import {
  prepararRecordatorioSchema,
  recordatorioCorreoSchema,
  recordatorioWhatsappSchema,
  reintentarRecordatorioSchema,
} from '@/lib/recordatorioValidation'
import { toActionError, type ActionState } from '@/lib/actionState'

/**
 * Server Actions de recordatorios de cobro (09-cuentas-por-cobrar). Las usan
 * la ficha del cliente y `/cobros`. Todas validan sesión, rol admin y datos
 * (`safeParse`) antes de llamar al servicio, que vuelve a verificar el rol.
 */

export interface RecordatorioActionState extends ActionState {
  preparacion?: PreparacionRecordatorio
  resultado?: ResultadoRecordatorio
}

const SIN_SESION = 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.'
const SOLO_ADMIN = 'Solo un administrador puede enviar recordatorios'

async function autorizar(): Promise<RecordatorioActionState | null> {
  if (!(await getSession())) return { error: SIN_SESION, success: null }
  if ((await getRol()) !== 'admin') return { error: SOLO_ADMIN, success: null }
  return null
}

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

function invalido(error: z.ZodError): RecordatorioActionState {
  const fieldErrors = fieldErrorsDeZod(error)
  return {
    error: Object.values(fieldErrors)[0] ?? 'Revisa los datos del recordatorio',
    success: null,
    fieldErrors,
  }
}

function errorDeDominio(e: unknown): RecordatorioActionState {
  if (e instanceof RecordatorioError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

function revalidar() {
  revalidatePath('/clientes', 'layout')
  revalidatePath('/cobros')
}

export async function prepararRecordatorioAction(input: unknown): Promise<RecordatorioActionState> {
  const denegado = await autorizar()
  if (denegado) return denegado
  const safe = prepararRecordatorioSchema.safeParse(input)
  if (!safe.success) return invalido(safe.error)
  try {
    const preparacion = await prepararRecordatorio(safe.data.clienteId, safe.data.facturaIds)
    return { error: null, success: null, preparacion }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function registrarRecordatorioWhatsappAction(
  input: unknown
): Promise<RecordatorioActionState> {
  const denegado = await autorizar()
  if (denegado) return denegado
  const safe = recordatorioWhatsappSchema.safeParse(input)
  if (!safe.success) return invalido(safe.error)
  try {
    const resultado = await registrarRecordatorio(safe.data)
    revalidar()
    return { error: null, success: 'Recordatorio registrado', resultado }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function enviarRecordatorioCorreoAction(
  input: unknown
): Promise<RecordatorioActionState> {
  const denegado = await autorizar()
  if (denegado) return denegado
  const safe = recordatorioCorreoSchema.safeParse(input)
  if (!safe.success) return invalido(safe.error)
  try {
    const resultado = await enviarCorreo(safe.data)
    revalidar()
    if (resultado.estado === 'fallido') {
      return {
        error: `No se pudo enviar el correo. ${resultado.error ?? ''}`.trim(),
        success: null,
        resultado,
      }
    }
    return { error: null, success: 'Correo enviado', resultado }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function reintentarRecordatorioCorreoAction(
  input: unknown
): Promise<RecordatorioActionState> {
  const denegado = await autorizar()
  if (denegado) return denegado
  const safe = reintentarRecordatorioSchema.safeParse(input)
  if (!safe.success) return invalido(safe.error)
  try {
    const resultado = await reintentarCorreo(safe.data.recordatorioId)
    revalidar()
    if (resultado.estado === 'fallido') {
      return {
        error: `El correo volvió a fallar. ${resultado.error ?? ''}`.trim(),
        success: null,
        resultado,
      }
    }
    return { error: null, success: 'Correo enviado', resultado }
  } catch (e) {
    return errorDeDominio(e)
  }
}
