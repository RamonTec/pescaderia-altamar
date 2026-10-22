import type { SupabaseClient } from '@supabase/supabase-js'
import type { ICategoriaGastoRepository } from './interfaces'
import type { CategoriaGasto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del catálogo de categorías de gasto (20-gastos).
 * Solo acceso a datos bajo RLS `es_admin()`; las reglas (sistema, un nivel)
 * las hace cumplir `categorias_gasto_guard` y el servicio.
 */

const COLUMNAS = 'id, nombre, categoria_padre_id, clave, es_sistema, activo, orden'

function normaliza(fila: CategoriaGasto): CategoriaGasto {
  return { ...fila, orden: Number(fila.orden), activo: Boolean(fila.activo), es_sistema: Boolean(fila.es_sistema) }
}

export function makeCategoriaGastoRepository(
  db: SupabaseClient = createClient()
): ICategoriaGastoRepository {
  return {
    async list() {
      const { data, error } = await db
        .from('categorias_gasto')
        .select(COLUMNAS)
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true })
      if (error) throw error
      return ((data ?? []) as CategoriaGasto[]).map(normaliza)
    },
    async create(data) {
      const { data: fila, error } = await db.from('categorias_gasto').insert(data).select(COLUMNAS).single()
      if (error) throw error
      return normaliza(fila as CategoriaGasto)
    },
    async update(id, cambios) {
      const { data: fila, error } = await db
        .from('categorias_gasto')
        .update(cambios)
        .eq('id', id)
        .select(COLUMNAS)
        .single()
      if (error) throw error
      return normaliza(fila as CategoriaGasto)
    },
  }
}
