'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession } from '@/lib/services/authService'
import { crearPedido, entregarPedido } from '@/lib/services/pedidoService'
import {
  crearFactura,
  InvoiceError,
  LimiteCreditoExcedido,
  type AdvertenciaLimiteCredito,
} from '@/lib/services/invoiceService'
import { pedidoFormSchema, entregaPedidoSchema } from '@/lib/pedidoValidation'
import { toActionError } from '@/lib/actionState'

export interface PedidoActionState {
  error: string | null
  success: string | null
  fieldErrors?: Record<string, string>
  /** Presente cuando una venta a crédito excede el límite del cliente. */
  advertenciaLimite?: AdvertenciaLimiteCredito
}

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

function errorDeDominio(e: unknown): PedidoActionState {
  if (e instanceof LimiteCreditoExcedido) {
    return { error: null, success: null, advertenciaLimite: e.advertencia }
  }
  if (e instanceof InvoiceError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

export async function crearPedidoAction(
  _prev: PedidoActionState,
  formData: FormData
): Promise<PedidoActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }

  const safe = pedidoFormSchema.safeParse(leerPayload(formData))
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }

  const v = safe.data
  const forzarLimite = formData.get('forzar_limite') === 'true'

  try {
    if (v.entrega_inmediata) {
      await crearFactura({
        cliente_id: v.cliente_id,
        condicion: v.condicion,
        fecha: v.fecha,
        forzar_limite: forzarLimite,
        items: v.items.map((i) => ({
          producto_id: i.producto_id,
          peso_kg: i.peso_kg,
          precio_usd_kg: i.precio_usd_kg,
        })),
      })
    } else {
      await crearPedido({
        cliente_id: v.cliente_id,
        fecha_entrega: v.fecha_entrega,
        notas: v.notas,
        items: v.items.map((i) => ({
          producto_id: i.producto_id,
          peso_estimado_kg: i.peso_kg,
          precio_usd_kg: i.precio_usd_kg,
        })),
      })
    }
  } catch (e) {
    return errorDeDominio(e)
  }

  revalidatePath('/pedidos')
  revalidatePath('/cobros')
  return { error: null, success: v.entrega_inmediata ? 'Venta registrada' : 'Pedido creado' }
}

export async function entregarPedidoAction(
  _prev: PedidoActionState,
  formData: FormData
): Promise<PedidoActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }

  const safe = entregaPedidoSchema.safeParse(leerPayload(formData))
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }

  const v = safe.data
  const forzarLimite = formData.get('forzar_limite') === 'true'

  try {
    await entregarPedido({
      pedido_id: v.pedido_id,
      condicion: v.condicion,
      fecha: v.fecha,
      forzar_limite: forzarLimite,
      pesos_reales: v.pesos_reales,
    })
  } catch (e) {
    return errorDeDominio(e)
  }

  revalidatePath('/pedidos')
  revalidatePath('/cobros')
  return { error: null, success: 'Pedido entregado y facturado' }
}

export async function anularPedidoAction(
  _prev: PedidoActionState,
  formData: FormData
): Promise<PedidoActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  // Anulación de pedido: se marca `anulado` (no se borra ni afecta stock,
  // porque un pedido pendiente aún no generó movimientos).
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Pedido no encontrado', success: null }

  const { createClient } = await import('@/lib/supabase/server')
  const db = await createClient()
  const { error } = await db.from('pedidos').update({ estado: 'anulado' }).eq('id', id)
  if (error) return { error: toActionError(error).error, success: null }

  revalidatePath('/pedidos')
  return { error: null, success: 'Pedido anulado' }
}
