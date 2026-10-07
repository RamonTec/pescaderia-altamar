import type { SupabaseClient } from '@supabase/supabase-js'
import type { IProveedorRepository, ProveedorResumen } from './interfaces'
import type { Proveedor } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Error de dominio: no se puede borrar físicamente un proveedor con compras
 * asociadas. La UI debe desactivarlo en su lugar.
 */
export class ProveedorConComprasError extends Error {
  constructor(proveedorId: string) {
    super(
      `El proveedor ${proveedorId} tiene compras asociadas y no se puede eliminar. Desactívalo en su lugar.`
    )
    this.name = 'ProveedorConComprasError'
  }
}

export function makeProveedorRepository(
  db: SupabaseClient = createClient()
): IProveedorRepository {
  return {
    async list({ incluirInactivos = true } = {}) {
      let q = db.from('proveedores').select('*').order('nombre')
      if (!incluirInactivos) q = q.eq('activo', true)
      const { data, error } = await q
      if (error) throw error
      return data as Proveedor[]
    },
    async listConResumen() {
      const { data, error } = await db
        .from('proveedores')
        .select(
          '*, representantes_proveedor(id, nombre, cedula, cargo, telefono), documentos_proveedor(tipo, representante_id), metodos_pago_proveedor(tipo, banco_codigo, numero_cuenta, telefono, email, preferido)'
        )
        .order('nombre')
      if (error) throw error
      return data as unknown as ProveedorResumen[]
    },
    async getById(id) {
      const { data, error } = await db
        .from('proveedores')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Proveedor
    },
    async create(input) {
      const { data, error } = await db.from('proveedores').insert(input).select().single()
      if (error) throw error
      return data as Proveedor
    },
    async update(id, input) {
      const { data, error } = await db
        .from('proveedores')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Proveedor
    },
    async countCompras(id) {
      const { count, error } = await db
        .from('compras')
        .select('id', { count: 'exact', head: true })
        .eq('proveedor_id', id)
      if (error) throw error
      return count ?? 0
    },
    async delete(id) {
      const count = await this.countCompras(id)
      if (count > 0) {
        throw new ProveedorConComprasError(id)
      }
      const { error } = await db.from('proveedores').delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const proveedorRepository = makeProveedorRepository()
