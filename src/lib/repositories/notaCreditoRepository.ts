import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  INotaCreditoRepository,
  NotaCreditoDetalle,
  NotaCreditoItemNuevo,
  NotaCreditoNueva,
  NotaCreditoResumen,
} from './interfaces'
import type { NotaCreditoItem, Producto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de notas de crédito.
 * La escritura (emitir/anular) va por RPC `security definer` (0014) porque
 * necesita leer el costo original de `factura_items` (columna sensible).
 */
const SELECT_RESUMEN = '*, factura:facturas(numero, cliente:clientes(id, nombre))'

export function makeNotaCreditoRepository(
  db: SupabaseClient = createClient()
): INotaCreditoRepository {
  return {
    async create(nota: NotaCreditoNueva, items: NotaCreditoItemNuevo[]) {
      const { data, error } = await db.rpc('registrar_nota_credito', {
        p_nota: nota,
        p_items: items,
      })
      if (error) throw error
      return data as string
    },
    async anular(id) {
      const { error } = await db.rpc('anular_nota_credito', { p_id: id })
      if (error) throw error
    },
    async list(filtroEstado) {
      let q = db.from('notas_credito').select(SELECT_RESUMEN)
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      const { data, error } = await q
        .order('numero', { ascending: false })
      if (error) throw error
      return data as unknown as NotaCreditoResumen[]
    },
    async getById(id) {
      const { data: nota, error } = await db
        .from('notas_credito')
        .select(SELECT_RESUMEN)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!nota) return null

      const { data: items, error: itemsError } = await db
        .from('nota_credito_items')
        .select('*')
        .eq('nota_credito_id', id)
      if (itemsError) throw itemsError

      const rows = (items ?? []) as NotaCreditoItem[]
      const facturaItemIds = [...new Set(rows.map((i) => i.factura_item_id))]
      const { data: facturaItems, error: fiError } = facturaItemIds.length
        ? await db.from('factura_items_view').select('id, producto_id').in('id', facturaItemIds)
        : { data: [], error: null }
      if (fiError) throw fiError

      const productoIds = [
        ...new Set(((facturaItems ?? []) as { producto_id: string }[]).map((f) => f.producto_id)),
      ]
      const { data: productos, error: prodError } = productoIds.length
        ? await db.from('productos').select('id, nombre').in('id', productoIds)
        : { data: [], error: null }
      if (prodError) throw prodError

      const productoPorFacturaItem = new Map(
        ((facturaItems ?? []) as { id: string; producto_id: string }[]).map((f) => [
          f.id,
          f.producto_id,
        ])
      )
      const porId = new Map(
        ((productos ?? []) as Pick<Producto, 'id' | 'nombre'>[]).map((p) => [p.id, p])
      )

      return {
        ...(nota as unknown as NotaCreditoResumen),
        items: rows.map((i) => {
          const productoId = productoPorFacturaItem.get(i.factura_item_id) ?? ''
          return {
            ...i,
            producto: porId.get(productoId) ?? { id: productoId, nombre: '—' },
          }
        }),
      } satisfies NotaCreditoDetalle
    },
    async listByFactura(facturaId) {
      const { data, error } = await db
        .from('notas_credito')
        .select(SELECT_RESUMEN)
        .eq('factura_id', facturaId)
        .order('numero', { ascending: false })
      if (error) throw error
      return data as unknown as NotaCreditoResumen[]
    },
    async totalEmitidoByCliente(clienteId) {
      const { data: facturas, error: fError } = await db
        .from('facturas')
        .select('id')
        .eq('cliente_id', clienteId)
      if (fError) throw fError
      const facturaIds = (facturas ?? []).map((f) => f.id as string)
      if (facturaIds.length === 0) return 0

      const { data, error } = await db
        .from('notas_credito')
        .select('total_usd')
        .eq('estado', 'emitida')
        .in('factura_id', facturaIds)
      if (error) throw error
      const rows = (data ?? []) as { total_usd: number }[]
      return rows.reduce((s, r) => s + Number(r.total_usd), 0)
    },
  }
}

export const notaCreditoRepository = makeNotaCreditoRepository()
