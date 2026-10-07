'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession, getRol } from '@/lib/services/authService'
import { CompraError, crearCompra, registrarPagoProveedor } from '@/lib/services/compraService'
import { compraFormSchema, pagoProveedorFormSchema } from '@/lib/compraValidation'
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
  if (e instanceof CompraError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

export async function crearCompraAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }

  const safe = compraFormSchema.safeParse(leerPayload(formData))
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }

  try {
    await crearCompra(safe.data)
  } catch (e) {
    return errorDeDominio(e)
  }

  revalidatePath('/compras')
  revalidatePath(`/proveedores/${safe.data.proveedor_id}`)
  return { error: null, success: 'Compra registrada' }
}

export async function registrarPagoProveedorAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if ((await getRol()) !== 'admin') {
    return { error: 'Solo un administrador puede registrar pagos a proveedores', success: null }
  }

  const safe = pagoProveedorFormSchema.safeParse(leerPayload(formData))
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }

  try {
    await registrarPagoProveedor(safe.data)
  } catch (e) {
    return errorDeDominio(e)
  }

  revalidatePath('/compras')
  revalidatePath('/proveedores', 'layout')
  return { error: null, success: 'Pago registrado' }
}
