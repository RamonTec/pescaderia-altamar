import type { SupabaseClient } from '@supabase/supabase-js'
import type { IMetodoPagoProveedorRepository } from './interfaces'
import type { MetodoPagoProveedor } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

export function makeMetodoPagoProveedorRepository(
  db: SupabaseClient = createClient()
): IMetodoPagoProveedorRepository {
  return {
    async listByProveedor(proveedorId) {
      const { data, error } = await db
        .from('metodos_pago_proveedor')
        .select('*')
        .eq('proveedor_id', proveedorId)
        .order('created_at')
      if (error) throw error
      return data as MetodoPagoProveedor[]
    },
    async create(input) {
      const { data, error } = await db
        .from('metodos_pago_proveedor')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as MetodoPagoProveedor
    },
    async update(id, input) {
      const { data, error } = await db
        .from('metodos_pago_proveedor')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as MetodoPagoProveedor
    },
    async delete(id) {
      const { error } = await db.from('metodos_pago_proveedor').delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const metodoPagoProveedorRepository = makeMetodoPagoProveedorRepository()
