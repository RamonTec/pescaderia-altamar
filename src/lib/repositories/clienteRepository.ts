import type { SupabaseClient } from '@supabase/supabase-js'
import type { IClienteRepository } from './interfaces'
import type { Cliente } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Error de dominio: no se puede borrar físicamente un cliente con
 * facturas o pedidos asociados. El servicio/UI debe desactivarlo en su lugar.
 */
export class ClienteConFacturasError extends Error {
  constructor(clienteId: string) {
    super(
      `El cliente ${clienteId} tiene facturas o pedidos asociados y no se puede eliminar. Desactívalo en su lugar.`
    )
    this.name = 'ClienteConFacturasError'
  }
}

export function makeClienteRepository(
  db: SupabaseClient = createClient()
): IClienteRepository {
  return {
    async list() {
      const { data, error } = await db.from('clientes').select('*').order('nombre')
      if (error) throw error
      return data as Cliente[]
    },
    async getById(id) {
      // `maybeSingle`: un id inexistente devuelve `null` (la ficha muestra
      // not-found) en vez de lanzar PGRST116 y caer en el `error.tsx`.
      const { data, error } = await db.from('clientes').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return (data as Cliente | null) ?? null
    },
    async create(input) {
      const { data, error } = await db.from('clientes').insert(input).select().single()
      if (error) throw error
      return data as Cliente
    },
    async update(id, input) {
      const { data, error } = await db
        .from('clientes')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Cliente
    },
    async delete(id) {
      const [facturas, pedidos] = await Promise.all([
        db
          .from('facturas')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', id),
        db
          .from('pedidos')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', id),
      ])

      if (facturas.error) throw facturas.error
      if (pedidos.error) throw pedidos.error

      const count = (facturas.count ?? 0) + (pedidos.count ?? 0)
      if (count > 0) {
        throw new ClienteConFacturasError(id)
      }

      const { error } = await db.from('clientes').delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const clienteRepository = makeClienteRepository()
