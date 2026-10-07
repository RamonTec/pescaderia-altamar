import type { SupabaseClient } from '@supabase/supabase-js'
import type { IRepresentanteLegalRepository } from './interfaces'
import type { RepresentanteLegal } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

export function makeRepresentanteLegalRepository(
  db: SupabaseClient = createClient()
): IRepresentanteLegalRepository {
  return {
    async listByCliente(clienteId) {
      const { data, error } = await db
        .from('representantes_legales')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at')
      if (error) throw error
      return data as RepresentanteLegal[]
    },
    async create(input) {
      const { data, error } = await db
        .from('representantes_legales')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as RepresentanteLegal
    },
    async update(id, input) {
      const { data, error } = await db
        .from('representantes_legales')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as RepresentanteLegal
    },
    async delete(id) {
      const { error } = await db.from('representantes_legales').delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const representanteLegalRepository = makeRepresentanteLegalRepository()
