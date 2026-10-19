import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  IProcesamientoRepository,
  ProcesamientoRegistrado,
  ProcesamientoResumen,
  ProcesoItemDetalle,
} from './interfaces'
import type { RepartoCosto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de procesamientos (16).
 *
 * - Escritura por RPC `registrar_procesamiento`: cabecera + N salidas + lotes
 *   hijos + movimientos en una sola transacción, con el costo del lote
 *   repartido en la base (el operador no puede leerlo).
 * - Lectura desde `procesamientos_view` y `proceso_items_view`: el costo
 *   llega `null` al operador desde la base. Dos consultas unidas aquí
 *   (PostgREST no infiere relaciones entre vistas), sin lógica de negocio.
 */

/** Una lista larga de uuids no cabe en la URL de PostgREST. */
const TRAMO = 100

const num = (v: unknown): number => Number(v ?? 0)
const numONull = (v: unknown): number | null => (v == null ? null : Number(v))

type FilaProcesamiento = {
  id: string
  fecha: string
  notas: string | null
  created_at: string
  lote_origen_id: string | null
  lote_origen_codigo: string | null
  producto_origen_id: string | null
  producto_origen_nombre: string | null
  producto_origen_codigo: string | null
  peso_entrada_kg: number | null
  costo_total_usd: number | null
  reparto_costo: RepartoCosto | null
}

type FilaItem = {
  id: string
  procesamiento_id: string
  producto_origen_id: string
  producto_origen_nombre: string
  producto_origen_codigo: string | null
  lote_origen_id: string
  peso_entrada_kg: number
  producto_destino_id: string
  producto_destino_nombre: string
  producto_destino_codigo: string | null
  peso_salida_kg: number
  costo_total_usd: number | null
  precio_referencia_usd_kg: number | null
  lote_destino_id: string | null
  lote_destino_codigo: string | null
}

function mapProcesoItem(i: FilaItem): ProcesoItemDetalle {
  return {
    id: i.id,
    procesamiento_id: i.procesamiento_id,
    producto_origen_id: i.producto_origen_id,
    lote_origen_id: i.lote_origen_id,
    peso_entrada_kg: num(i.peso_entrada_kg),
    producto_destino_id: i.producto_destino_id,
    peso_salida_kg: num(i.peso_salida_kg),
    costo_total_usd: numONull(i.costo_total_usd),
    precio_referencia_usd_kg: numONull(i.precio_referencia_usd_kg),
    origen: { id: i.producto_origen_id, nombre: i.producto_origen_nombre, codigo: i.producto_origen_codigo },
    destino: {
      id: i.producto_destino_id,
      nombre: i.producto_destino_nombre,
      codigo: i.producto_destino_codigo,
    },
    lote_destino_id: i.lote_destino_id,
    lote_destino_codigo: i.lote_destino_codigo,
  }
}

export function makeProcesamientoRepository(
  db: SupabaseClient = createClient()
): IProcesamientoRepository {
  return {
    async create(procesamiento, salidas) {
      const { data, error } = await db.rpc('registrar_procesamiento', {
        p_procesamiento: procesamiento,
        p_salidas: salidas,
      })
      if (error) throw error
      const r = data as ProcesamientoRegistrado
      return {
        procesamiento_id: r.procesamiento_id,
        reparto_costo: r.reparto_costo,
        lotes: (r.lotes ?? []).map((l) => ({ ...l, peso_kg: Number(l.peso_kg) })),
      }
    },

    async list() {
      const { data, error } = await db
        .from('procesamientos_view')
        .select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const cabeceras = (data ?? []) as FilaProcesamiento[]
      const ids = cabeceras.map((p) => p.id)

      const tramos: string[][] = []
      for (let i = 0; i < ids.length; i += TRAMO) tramos.push(ids.slice(i, i + TRAMO))
      const resultados = await Promise.all(
        tramos.map((t) =>
          db
            .from('proceso_items_view')
            .select('*')
            .in('procesamiento_id', t)
            .order('peso_salida_kg', { ascending: false })
        )
      )
      const porProcesamiento = new Map<string, ProcesoItemDetalle[]>()
      for (const r of resultados) {
        if (r.error) throw r.error
        for (const fila of (r.data ?? []) as FilaItem[]) {
          const lista = porProcesamiento.get(fila.procesamiento_id) ?? []
          lista.push(mapProcesoItem(fila))
          porProcesamiento.set(fila.procesamiento_id, lista)
        }
      }

      return cabeceras.map(
        (p): ProcesamientoResumen => ({
          id: p.id,
          fecha: p.fecha,
          notas: p.notas,
          created_at: p.created_at,
          lote_origen_id: p.lote_origen_id,
          lote_origen_codigo: p.lote_origen_codigo,
          peso_entrada_kg: numONull(p.peso_entrada_kg),
          costo_total_usd: numONull(p.costo_total_usd),
          reparto_costo: p.reparto_costo,
          origen: p.producto_origen_id
            ? {
                id: p.producto_origen_id,
                nombre: p.producto_origen_nombre ?? '—',
                codigo: p.producto_origen_codigo,
              }
            : null,
          proceso_items: porProcesamiento.get(p.id) ?? [],
        })
      )
    },
  }
}

export const procesamientoRepository = makeProcesamientoRepository()
