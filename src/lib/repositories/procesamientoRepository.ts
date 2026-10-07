import type { SupabaseClient } from '@supabase/supabase-js'
import type { IProcesamientoRepository, ProcesamientoResumen } from './interfaces'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de procesamientos.
 * La escritura va por RPC (0013): procesamiento + lotes + movimientos en una
 * sola transacción, con el costo del origen calculado en la base (el operador
 * no puede leerlo, ver 0003).
 */

const SELECT_RESUMEN = `*, proceso_items(*,
  origen:productos!proceso_items_producto_origen_id_fkey(id, nombre, codigo),
  destino:productos!proceso_items_producto_destino_id_fkey(id, nombre, codigo))`

export function makeProcesamientoRepository(
  db: SupabaseClient = createClient()
): IProcesamientoRepository {
  return {
    async create(procesamiento, items) {
      const { data, error } = await db.rpc('registrar_procesamiento', {
        p_procesamiento: procesamiento,
        p_items: items,
      })
      if (error) throw error
      return data as string
    },
    async list() {
      const { data, error } = await db
        .from('procesamientos')
        .select(SELECT_RESUMEN)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ProcesamientoResumen[]
    },
  }
}

export const procesamientoRepository = makeProcesamientoRepository()
