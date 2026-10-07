import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lote, SugerenciaLotes, TrazabilidadLote } from '@/types/domain'
import type { FiltrosLotes, PaginaLotes } from '@/lib/repositories/interfaces'
import type { CerrarLoteValues, PerdidaLoteFormValues } from '@/lib/loteValidation'
import { TOLERANCIA_KG } from '@/lib/loteValidation'
import { makeLoteRepository } from '@/lib/repositories/loteRepository'
import { createClient } from '@/lib/supabase/server'
import { formatKg } from '@/lib/format'
import { redondea3 } from '@/lib/lotes'

/**
 * LoteService (SRP, /SPEC.md §6): asignación PEPS, pérdidas y cierre de
 * lote, trazabilidad y resultado por lote (07-lotes).
 *
 * Las escrituras que tocan stock las hace la base (RPC `security definer`
 * con lock de la fila del lote); aquí solo se validan antes para dar un
 * error claro en el campo. El cálculo del resultado (`resultadoLote`) es
 * puro: recibe la trazabilidad ya cargada.
 */

export class LoteError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'LoteError'
  }
}

export { diasEnCava, esAntiguo, porcentajeRestante, resultadoLote } from '@/lib/lotes'

/* ============================ Lecturas ============================ */

export async function listarLotes(
  filtros: FiltrosLotes,
  db?: SupabaseClient
): Promise<PaginaLotes> {
  const client = db ?? (await createClient())
  return makeLoteRepository(client).list(filtros)
}

export async function lotesAbiertosDe(productoId: string, db?: SupabaseClient): Promise<Lote[]> {
  const client = db ?? (await createClient())
  return makeLoteRepository(client).listAbiertos(productoId)
}

/** Propuesta PEPS para una línea de venta (sin costos). */
export async function sugerirLotes(
  productoId: string,
  pesoKg: number,
  db?: SupabaseClient
): Promise<SugerenciaLotes> {
  if (!(pesoKg > 0)) {
    return { controla_stock: true, suficiente: true, disponible_kg: null, faltante_kg: 0, asignacion: [] }
  }
  const client = db ?? (await createClient())
  return makeLoteRepository(client).sugerir(productoId, Math.round(pesoKg * 1000) / 1000)
}

/** Lote, su árbol (hijos procesados) y todo lo que les pasó. */
export async function getTrazabilidad(
  loteId: string,
  db?: SupabaseClient
): Promise<TrazabilidadLote | null> {
  const client = db ?? (await createClient())
  const repo = makeLoteRepository(client)
  const arbol = await repo.getArbol(loteId)
  const lote = arbol.find((l) => l.id === loteId)
  if (!lote) return null
  const movimientos = await repo.getMovimientosArbol(arbol)
  return { lote, arbol, ...movimientos }
}

/* ============================ Escrituras ============================ */

async function loteAbierto(loteId: string, db: SupabaseClient): Promise<Lote> {
  const lote = await makeLoteRepository(db).getById(loteId)
  if (!lote) throw new LoteError('El lote no existe')
  if (lote.estado !== 'abierto') throw new LoteError(`El lote ${lote.codigo} no está abierto`)
  return lote
}

/** Pérdida fuera del procesamiento (cualquier usuario): kg ≤ stock del lote. */
export async function registrarPerdida(
  input: PerdidaLoteFormValues,
  db?: SupabaseClient
): Promise<{ perdida_id: string; lote: Lote }> {
  const client = db ?? (await createClient())
  const lote = await loteAbierto(input.lote_id, client)
  const peso = redondea3(input.peso_kg)
  if (peso <= 0) throw new LoteError('El peso debe ser mayor a 0', 'peso_kg')
  if (peso > lote.stock_kg + TOLERANCIA_KG) {
    throw new LoteError(`El lote ${lote.codigo} solo tiene ${formatKg(lote.stock_kg)}`, 'peso_kg')
  }
  const perdidaId = await makeLoteRepository(client).registrarPerdida({
    lote_id: lote.id,
    peso_kg: peso,
    motivo: input.motivo,
    detalle: input.detalle.trim() || null,
  })
  return { perdida_id: perdidaId, lote }
}

/** Cierra el lote dando de baja su remanente (motivo `cierre`). */
export async function cerrarLote(
  input: CerrarLoteValues,
  db?: SupabaseClient
): Promise<{ peso_baja_kg: number; lote: Lote }> {
  const client = db ?? (await createClient())
  const lote = await makeLoteRepository(client).getById(input.lote_id)
  if (!lote) throw new LoteError('El lote no existe')
  if (lote.estado === 'cerrado') throw new LoteError(`El lote ${lote.codigo} ya está cerrado`)
  const { peso_baja_kg } = await makeLoteRepository(client).cerrar(
    lote.id,
    input.detalle.trim() || null,
    redondea3(input.peso_esperado_kg)
  )
  return { peso_baja_kg, lote }
}
