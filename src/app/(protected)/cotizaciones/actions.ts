'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/lib/actionState'
import { toActionError } from '@/lib/actionState'
import {
  anularCotizacionSchema,
  cotizacionFormSchema,
  responderCotizacionSchema,
  type AnularCotizacionInput,
  type CotizacionFormValues,
  type ResponderCotizacionInput,
} from '@/lib/cotizacionValidation'
import type { ModoCotizacionForm } from '@/lib/cotizaciones/formulario'
import {
  aceptar,
  anular,
  CotizacionError,
  getCotizacion,
  guardarCotizacion,
  marcarEnviada,
  rechazar,
  renovar,
} from '@/lib/services/cotizacionService'
import type { CotizacionDetalle, CotizacionInput } from '@/types/domain'

/**
 * Server Actions de cotizaciones (21): `safeParse` → servicio →
 * `ActionState` + `revalidatePath`. Los errores de la base llegan como
 * `CotizacionError` con su campo (`hint` mapeado en el servicio).
 */

export interface GuardarCotizacionState extends ActionState {
  id?: string
}

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

function errorDe(e: unknown): ActionState {
  if (e instanceof CotizacionError) {
    return { error: e.message, success: null, fieldErrors: e.campo ? { [e.campo]: e.message } : undefined }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

function revalidar(id?: string) {
  revalidatePath('/cotizaciones')
  if (id) revalidatePath(`/cotizaciones/${id}`)
}

function inputDe(v: CotizacionFormValues): CotizacionInput {
  const registrado = v.tipo_cliente === 'registrado'
  return {
    fecha: v.fecha,
    validez_dias: v.validez_dias,
    cliente_id: registrado ? v.cliente_id : null,
    cliente_nombre: registrado ? null : v.cliente_nombre,
    cliente_telefono: registrado ? null : v.cliente_telefono || null,
    con_iva: v.con_iva,
    descuento_usd: v.descuento_usd,
    notas_cliente: v.notas_cliente,
    notas_internas: v.notas_internas,
    terminos: v.terminos,
    items: v.items.map((i) => ({
      producto_id: i.producto_id,
      peso_kg: i.peso_kg,
      precio_usd_kg: i.precio_usd_kg,
      nota: i.nota,
    })),
  }
}

const MENSAJE_GUARDADO: Record<ModoCotizacionForm, string> = {
  crear: 'Cotización creada',
  editar: 'Cotización actualizada',
  duplicar: 'Cotización duplicada como borrador',
  renovar: 'Cotización renovada',
}

/** Crea, edita, duplica o renueva. `id` solo en `editar` y `renovar`. */
export async function guardarCotizacionAction(
  modo: ModoCotizacionForm,
  id: string | null,
  payload: unknown
): Promise<GuardarCotizacionState> {
  const safe = cotizacionFormSchema.safeParse(payload)
  if (!safe.success) {
    return { error: 'Revisa los campos marcados', success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  }
  const destino = modo === 'editar' || modo === 'renovar' ? id : null
  if ((modo === 'editar' || modo === 'renovar') && !z.string().uuid().safeParse(id).success) {
    return { error: 'Cotización inválida', success: null }
  }
  try {
    const input = inputDe(safe.data)
    const nuevoId = modo === 'renovar' && destino ? await renovar(destino, input) : await guardarCotizacion(destino, input)
    revalidar(nuevoId)
    return { error: null, success: MENSAJE_GUARDADO[modo], id: nuevoId }
  } catch (e) {
    return errorDe(e)
  }
}

export async function responderCotizacionAction(input: ResponderCotizacionInput): Promise<ActionState> {
  const safe = responderCotizacionSchema.safeParse(input)
  if (!safe.success) {
    return { error: 'Revisa los campos marcados', success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  }
  try {
    if (safe.data.respuesta === 'aceptada') await aceptar(safe.data.id)
    else await rechazar(safe.data.id, safe.data.motivo)
    revalidar(safe.data.id)
    return {
      error: null,
      success: safe.data.respuesta === 'aceptada' ? 'Cotización marcada como aceptada' : 'Cotización marcada como rechazada',
    }
  } catch (e) {
    return errorDe(e)
  }
}

export async function anularCotizacionAction(input: AnularCotizacionInput): Promise<ActionState> {
  const safe = anularCotizacionSchema.safeParse(input)
  if (!safe.success) {
    return { error: 'Revisa los campos marcados', success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  }
  try {
    await anular(safe.data.id, safe.data.motivo)
    revalidar(safe.data.id)
    return { error: null, success: 'Cotización anulada' }
  } catch (e) {
    return errorDe(e)
  }
}

/** Borrador → enviada al compartir (P10); no-op en otro estado. */
export async function marcarEnviadaAction(id: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Cotización inválida', success: null }
  try {
    const c = await marcarEnviada(id)
    revalidar(id)
    return { error: null, success: c.estado === 'enviada' ? 'Cotización marcada como enviada' : null }
  } catch (e) {
    return errorDe(e)
  }
}

/** Detalle para abrir el formulario desde el listado (editar, duplicar, renovar). */
export async function obtenerCotizacionAction(
  id: string
): Promise<{ cotizacion: CotizacionDetalle | null; error: string | null }> {
  if (!z.string().uuid().safeParse(id).success) return { cotizacion: null, error: 'Cotización inválida' }
  try {
    const cotizacion = await getCotizacion(id)
    return { cotizacion, error: cotizacion ? null : 'La cotización no existe' }
  } catch (e) {
    return { cotizacion: null, error: errorDe(e).error }
  }
}
