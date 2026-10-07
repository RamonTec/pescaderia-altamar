'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { getSession, requireAdmin } from '@/lib/services/authService'
import {
  ContratoError,
  cambiarEstado,
  generarDesdeCompra,
  generarDesdeFactura,
} from '@/lib/services/contratoService'
import { cambiarEstadoContratoSchema, generarContratoSchema } from '@/lib/contratoValidation'
import { numeroContrato } from '@/lib/contratos/textos'
import { toActionError, type ActionState } from '@/lib/actionState'

/**
 * Server Actions de contratos (06-contratos): `safeParse` con zod → servicio
 * → `ActionState`. Solo admin (el servicio también lo exige).
 */

const MSG_SOLO_ADMIN = 'Solo un administrador puede gestionar contratos'

export interface GenerarContratoActionState extends ActionState {
  contrato?: { id: string; numero: number }
}

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

function errorDeDominio(e: unknown): ActionState {
  if (e instanceof ContratoError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

function revalidarOrigenes() {
  revalidatePath('/contratos')
  revalidatePath('/cobros')
  revalidatePath('/compras')
  revalidatePath('/clientes/[id]', 'page')
  revalidatePath('/proveedores/[id]', 'page')
}

export async function generarContratoAction(input: unknown): Promise<GenerarContratoActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if (!(await requireAdmin())) return { error: MSG_SOLO_ADMIN, success: null }

  const safe = generarContratoSchema.safeParse(input)
  if (!safe.success) {
    return { error: 'Revisa los campos marcados', success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  }

  try {
    const opciones = { dias_credito: safe.data.dias_credito, notas: safe.data.notas }
    const contrato =
      safe.data.tipo === 'venta_credito'
        ? await generarDesdeFactura(safe.data.factura_id, opciones)
        : await generarDesdeCompra(safe.data.compra_id, opciones)
    revalidarOrigenes()
    return {
      error: null,
      success: `Contrato ${numeroContrato(contrato.numero)} generado`,
      contrato: { id: contrato.id, numero: contrato.numero },
    }
  } catch (e) {
    return errorDeDominio(e)
  }
}

const EXITO_ESTADO = {
  enviado: 'marcado como enviado',
  firmado: 'marcado como firmado',
  anulado: 'anulado',
} as const

export async function cambiarEstadoContratoAction(input: unknown): Promise<ActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if (!(await requireAdmin())) return { error: MSG_SOLO_ADMIN, success: null }

  const safe = cambiarEstadoContratoSchema.safeParse(input)
  if (!safe.success) return { error: 'Datos inválidos', success: null }

  try {
    const contrato = await cambiarEstado(safe.data.id, safe.data.estado)
    revalidarOrigenes()
    return {
      error: null,
      success: `Contrato ${numeroContrato(contrato.numero)} ${EXITO_ESTADO[safe.data.estado]}`,
    }
  } catch (e) {
    return errorDeDominio(e)
  }
}
