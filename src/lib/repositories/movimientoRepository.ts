import type { SupabaseClient } from '@supabase/supabase-js'
import type { IMovimientoRepository } from './interfaces'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del ledger de movimientos (solo escritura).
 * No se usa `.select()` tras el insert: `movimientos` no es legible
 * directamente (0003), solo vía `movimientos_view`.
 */
export function makeMovimientoRepository(
  db: SupabaseClient = createClient()
): IMovimientoRepository {
  return {
    async create(movimiento) {
      const { error } = await db.from('movimientos').insert(movimiento)
      if (error) throw error
    },
  }
}
