import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  IPedidoRepository,
  PedidoDetalle,
  PedidoResumen,
} from './interfaces'
import type { Pedido, PedidoItem, Producto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de pedidos.
 * La escritura (pedido + items) va por RPC (0014) en una sola transacción.
 */
const SELECT_RESUMEN = '*, cliente:clientes(id, nombre, rif_ci, bloqueado, dias_credito)'

export function makePedidoRepository(db: SupabaseClient = createClient()): IPedidoRepository {
  return {
    async create(pedido, items) {
      const { data, error } = await db.rpc('registrar_pedido', {
        p_pedido: pedido,
        p_items: items,
      })
      if (error) throw error
      return data as string
    },
    async list(filtroEstado) {
      let q = db.from('pedidos').select(SELECT_RESUMEN)
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      const { data, error } = await q
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as PedidoResumen[]
    },
    async getById(id) {
      const { data: pedido, error } = await db
        .from('pedidos')
        .select(SELECT_RESUMEN)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!pedido) return null

      const { data: items, error: itemsError } = await db
        .from('pedido_items')
        .select('*')
        .eq('pedido_id', id)
      if (itemsError) throw itemsError

      const rows = (items ?? []) as PedidoItem[]
      const productoIds = [...new Set(rows.map((i) => i.producto_id))]
      const { data: productos, error: prodError } = productoIds.length
        ? await db.from('productos').select('id, nombre, codigo').in('id', productoIds)
        : { data: [], error: null }
      if (prodError) throw prodError

      const porId = new Map(
        ((productos ?? []) as Pick<Producto, 'id' | 'nombre' | 'codigo'>[]).map((p) => [p.id, p])
      )

      return {
        ...(pedido as unknown as PedidoResumen),
        items: rows.map((i) => ({
          ...i,
          producto: porId.get(i.producto_id) ?? { id: i.producto_id, nombre: '—', codigo: null },
        })),
      } satisfies PedidoDetalle
    },
    async listByCliente(clienteId) {
      const { data, error } = await db
        .from('pedidos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Pedido[]
    },
  }
}

export const pedidoRepository = makePedidoRepository()
