import type { SupabaseClient } from '@supabase/supabase-js'
import type { IRepresentanteProveedorRepository } from './interfaces'
import type { RepresentanteProveedor } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

export function makeRepresentanteProveedorRepository(
  db: SupabaseClient = createClient()
): IRepresentanteProveedorRepository {
  return {
    async listByProveedor(proveedorId) {
      const { data, error } = await db
        .from('representantes_proveedor')
        .select('*')
        .eq('proveedor_id', proveedorId)
        .order('created_at')
      if (error) throw error
      return data as RepresentanteProveedor[]
    },
    async create(input) {
      const { data, error } = await db
        .from('representantes_proveedor')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as RepresentanteProveedor
    },
    async update(id, input) {
      const { data, error } = await db
        .from('representantes_proveedor')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as RepresentanteProveedor
    },
    async delete(id) {
      const { error } = await db.from('representantes_proveedor').delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const representanteProveedorRepository = makeRepresentanteProveedorRepository()
