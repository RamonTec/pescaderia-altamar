'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession, requireAdmin } from '@/lib/services/authService'
import {
  cerrarLote,
  listarLotes,
  LoteError,
  lotesAbiertosDe,
  registrarPerdida,
  sugerirLotes,
} from '@/lib/services/loteService'
import { cerrarLoteSchema, perdidaLoteFormSchema } from '@/lib/loteValidation'
import { toActionError, type ActionState } from '@/lib/actionState'
import { formatKg } from '@/lib/format'
import type { EstadoLote, Lote, SugerenciaLotes } from '@/types/domain'
import type { PaginaLotes } from '@/lib/repositories/interfaces'

/**
 * Server Actions de lotes (07-lotes): lecturas que la UI pide en vivo
 * (sugerencia PEPS, lotes abiertos, página de lotes) y escrituras de
 * pérdida y cierre. Toda lectura de lotes pasa por `lotes_view`: al operador
 * el costo le llega `null`; aquí se quita igual para no mandarlo al cliente
 * si no es admin.
 */

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

function errorDeDominio(e: unknown, campoStock = 'peso_kg'): ActionState {
  if (e instanceof LoteError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }
  const pg = (e ?? {}) as { code?: string; hint?: string; message?: string }
  if (pg.code === 'P0001' && pg.hint === 'stock_insuficiente' && pg.message) {
    return { error: pg.message, success: null, fieldErrors: { [campoStock]: pg.message } }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

async function sinCostos(lotes: Lote[]): Promise<Lote[]> {
  if (await requireAdmin()) return lotes
  return lotes.map((l) => ({ ...l, costo_usd_kg: null }))
}

const uuid = z.string().uuid()

/** Propuesta PEPS para una línea de venta (sin costos). */
export async function sugerirLotesAction(
  productoId: string,
  pesoKg: number
): Promise<{ data: SugerenciaLotes | null; error: string | null }> {
  if (!(await getSession())) return { data: null, error: 'Sin sesión' }
  if (!uuid.safeParse(productoId).success || !Number.isFinite(pesoKg)) {
    return { data: null, error: 'Datos inválidos' }
  }
  try {
    return { data: await sugerirLotes(productoId, pesoKg), error: null }
  } catch (e) {
    return { data: null, error: toActionError(e).error }
  }
}

/** Lotes abiertos con stock de un producto, en PEPS (para cambiar la asignación). */
export async function lotesAbiertosAction(
  productoId: string
): Promise<{ data: Lote[]; error: string | null }> {
  if (!(await getSession())) return { data: [], error: 'Sin sesión' }
  if (!uuid.safeParse(productoId).success) return { data: [], error: 'Producto inválido' }
  try {
    return { data: await sinCostos(await lotesAbiertosDe(productoId)), error: null }
  } catch (e) {
    return { data: [], error: toActionError(e).error }
  }
}

const filtrosSchema = z.object({
  estado: z.enum(['abierto', 'agotado', 'cerrado']).nullable().optional(),
  productoId: uuid.nullable().optional(),
  proveedorId: uuid.nullable().optional(),
  codigo: z.string().max(60).optional(),
  page: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(100),
})

/** Página de lotes (pestaña Lotes de `/inventario`, paginación en servidor). */
export async function listarLotesAction(filtros: {
  estado?: EstadoLote | null
  productoId?: string | null
  proveedorId?: string | null
  codigo?: string
  page: number
  pageSize: number
}): Promise<{ data: PaginaLotes | null; error: string | null }> {
  if (!(await getSession())) return { data: null, error: 'Sin sesión' }
  const safe = filtrosSchema.safeParse(filtros)
  if (!safe.success) return { data: null, error: 'Filtros inválidos' }
  try {
    const pagina = await listarLotes(safe.data)
    return { data: { ...pagina, rows: await sinCostos(pagina.rows) }, error: null }
  } catch (e) {
    return { data: null, error: toActionError(e).error }
  }
}

function revalidarLote(loteId: string) {
  revalidatePath('/inventario')
  revalidatePath(`/inventario/lotes/${loteId}`)
}

/** Pérdida en un lote (cualquier usuario): kg, motivo y detalle. */
export async function registrarPerdidaAction(input: unknown): Promise<ActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  const safe = perdidaLoteFormSchema.safeParse(input)
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }
  try {
    const { lote } = await registrarPerdida(safe.data)
    revalidarLote(lote.id)
    return { error: null, success: `Pérdida registrada en ${lote.codigo}` }
  } catch (e) {
    return errorDeDominio(e)
  }
}

/** Cierra un lote dando de baja su remanente (confirmado por el usuario). */
export async function cerrarLoteAction(input: unknown): Promise<ActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  const safe = cerrarLoteSchema.safeParse(input)
  if (!safe.success) return { error: 'Datos inválidos', success: null }
  try {
    const { lote, peso_baja_kg } = await cerrarLote(safe.data)
    revalidarLote(lote.id)
    return {
      error: null,
      success:
        peso_baja_kg > 0
          ? `Lote ${lote.codigo} cerrado · ${formatKg(peso_baja_kg)} dados de baja`
          : `Lote ${lote.codigo} cerrado`,
    }
  } catch (e) {
    return errorDeDominio(e)
  }
}
