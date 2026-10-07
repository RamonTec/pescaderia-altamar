import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CompraDetalle,
  CompraResumen,
  ICompraRepository,
} from './interfaces'
import type { Compra, CompraItem, PagoProveedor, Producto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de compras.
 * Las escrituras van por RPC (0012) para que compra + items + movimientos, o
 * pago + actualización de saldo, ocurran en una sola transacción.
 * Los items se leen de `compra_items_view` (0003): el costo llega `null` al operador.
 */

const SELECT_RESUMEN = '*, proveedor:proveedores(id, nombre, rif_ci, bloqueado)'

export function makeCompraRepository(db: SupabaseClient = createClient()): ICompraRepository {
  return {
    async create(compra, items, movimientos) {
      const { data, error } = await db.rpc('registrar_compra', {
        p_compra: compra,
        p_items: items,
        p_movimientos: movimientos,
      })
      if (error) throw error
      return data as string
    },
    async list() {
      const { data, error } = await db
        .from('compras')
        .select(SELECT_RESUMEN)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as CompraResumen[]
    },
    async getById(id) {
      const { data: compra, error } = await db
        .from('compras')
        .select(SELECT_RESUMEN)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!compra) return null

      const [itemsRes, pagosRes] = await Promise.all([
        db.from('compra_items_view').select('*').eq('compra_id', id),
        db
          .from('pagos_proveedores')
          .select('*')
          .eq('compra_id', id)
          .order('fecha', { ascending: true })
          .order('created_at', { ascending: true }),
      ])
      if (itemsRes.error) throw itemsRes.error
      if (pagosRes.error) throw pagosRes.error

      const items = (itemsRes.data ?? []) as CompraItem[]
      const productoIds = [...new Set(items.map((i) => i.producto_id))]
      const { data: productos, error: prodError } = productoIds.length
        ? await db.from('productos').select('id, nombre, codigo').in('id', productoIds)
        : { data: [], error: null }
      if (prodError) throw prodError

      const porId = new Map(
        ((productos ?? []) as Pick<Producto, 'id' | 'nombre' | 'codigo'>[]).map((p) => [p.id, p])
      )

      return {
        ...(compra as unknown as CompraResumen),
        items: items.map((i) => ({
          ...i,
          producto: porId.get(i.producto_id) ?? { id: i.producto_id, nombre: '—', codigo: null },
        })),
        pagos: (pagosRes.data ?? []) as PagoProveedor[],
      } satisfies CompraDetalle
    },
    async listAbiertasByProveedor(proveedorId) {
      const { data, error } = await db
        .from('compras')
        .select('id, subtotal_usd, pagado_usd')
        .eq('proveedor_id', proveedorId)
        .eq('estado', 'abierta')
      if (error) throw error
      return (data ?? []) as Pick<Compra, 'id' | 'subtotal_usd' | 'pagado_usd'>[]
    },
    async registrarPago(pago) {
      const { data, error } = await db.rpc('registrar_pago_proveedor', { p_pago: pago })
      if (error) throw error
      return data as string
    },
  }
}

export const compraRepository = makeCompraRepository()
