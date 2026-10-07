import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CompraDetalle,
  CompraRegistrada,
  CompraResumen,
  ICompraRepository,
} from './interfaces'
import type { Compra, CompraItem, PagoProveedor, Producto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

const SELECT_RESUMEN = '*, proveedor:proveedores(id, nombre, rif_ci, bloqueado)'
const SELECT_INNER = '*, proveedor:proveedores!inner(id, nombre, rif_ci, bloqueado)'

export function makeCompraRepository(db: SupabaseClient = createClient()): ICompraRepository {
  return {
    async create(compra, items) {
      const { data, error } = await db.rpc('registrar_compra', {
        p_compra: compra,
        p_items: items,
      })
      if (error) throw error
      const r = data as CompraRegistrada
      return {
        compra_id: r.compra_id,
        lotes: (r.lotes ?? []).map((l) => ({ ...l, peso_kg: Number(l.peso_kg) })),
      }
    },
    async list(filtros) {
      const start = filtros.page * filtros.pageSize
      const end = start + filtros.pageSize - 1

      const query = db
        .from('compras')
        .select(filtros.q ? SELECT_INNER : SELECT_RESUMEN, { count: 'exact' })

      if (filtros.estado && filtros.estado !== 'todas') {
        query.eq('estado', filtros.estado)
      }

      if (filtros.q) {
        // filter by proveedor nombre or rif_ci
        query.or(`nombre.ilike.%${filtros.q}%,rif_ci.ilike.%${filtros.q}%`, {
          foreignTable: 'proveedores',
        })
      }

      const { data, count, error } = await query
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) throw error

      return {
        rows: data as unknown as CompraResumen[],
        total: count ?? 0,
      }
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
