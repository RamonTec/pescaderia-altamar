import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FacturaDetalle,
  FacturaResumen,
  IFacturaRepository,
} from './interfaces'
import type { Factura, FacturaItem, NotaCredito, Pago, Producto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'
import { mapearResultadoCambioIva, mapearResultadoCorreccion, mapearTrazabilidad } from './trazabilidadFacturaMapper'

/**
 * Implementación Supabase del repositorio de facturas.
 * La escritura va por RPC (`registrar_factura`, 07-lotes: asigna lotes y
 * calcula el costo en la base); los items se leen de `factura_items_view`
 * (0003): el costo llega `null` al operador.
 */
const SELECT_RESUMEN = '*, cliente:clientes(id, nombre, rif_ci)'

export function makeFacturaRepository(db: SupabaseClient = createClient()): IFacturaRepository {
  return {
    async create(factura, items, pedidoId, pesosReales) {
      const { data, error } = await db.rpc('registrar_factura', {
        p_factura: factura,
        p_items: items,
        p_pedido_id: pedidoId ?? null,
        p_pesos_reales: pesosReales ?? null,
      })
      if (error) throw error
      return data as string
    },
    async list(filtroEstado) {
      let q = db.from('facturas').select(SELECT_RESUMEN)
      if (filtroEstado) q = q.eq('estado', filtroEstado)
      const { data, error } = await q
        .order('numero', { ascending: false })
      if (error) throw error
      return data as unknown as FacturaResumen[]
    },
    async getById(id) {
      const { data: factura, error } = await db
        .from('facturas')
        .select(SELECT_RESUMEN)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!factura) return null

      const [itemsRes, pagosRes, notasRes] = await Promise.all([
        db.from('factura_items_view').select('*').eq('factura_id', id),
        db.from('pagos').select('*').eq('factura_id', id).order('fecha', { ascending: true }),
        db.from('notas_credito').select('*').eq('factura_id', id).order('fecha', { ascending: true }),
      ])
      if (itemsRes.error) throw itemsRes.error
      if (pagosRes.error) throw pagosRes.error
      if (notasRes.error) throw notasRes.error

      const items = (itemsRes.data ?? []) as FacturaItem[]
      const productoIds = [...new Set(items.map((i) => i.producto_id))]
      const { data: productos, error: prodError } = productoIds.length
        ? await db.from('productos').select('id, nombre, codigo').in('id', productoIds)
        : { data: [], error: null }
      if (prodError) throw prodError

      const porId = new Map(
        ((productos ?? []) as Pick<Producto, 'id' | 'nombre' | 'codigo'>[]).map((p) => [p.id, p])
      )

      return {
        ...(factura as unknown as FacturaResumen),
        items: items.map((i) => ({
          ...i,
          producto: porId.get(i.producto_id) ?? { id: i.producto_id, nombre: '—', codigo: null },
        })),
        pagos: (pagosRes.data ?? []) as Pago[],
        notas_credito: (notasRes.data ?? []) as NotaCredito[],
      } satisfies FacturaDetalle
    },
    async getByCliente(clienteId) {
      const { data, error } = await db
        .from('facturas')
        .select(SELECT_RESUMEN)
        .eq('cliente_id', clienteId)
        .order('numero', { ascending: false })
      if (error) throw error
      return data as unknown as FacturaResumen[]
    },
    async listAbiertasByCliente(clienteId) {
      const { data, error } = await db
        .from('facturas')
        .select('id, total_usd, pagado_usd')
        .eq('cliente_id', clienteId)
        .eq('estado', 'abierta')
      if (error) throw error
      return (data ?? []) as Pick<Factura, 'id' | 'total_usd' | 'pagado_usd'>[]
    },
    async listCerradasByCliente(clienteId) {
      const { data, error } = await db
        .from('facturas')
        .select('id, total_usd, pagado_usd')
        .eq('cliente_id', clienteId)
        .eq('estado', 'pagada')
      if (error) throw error
      return (data ?? []) as Pick<Factura, 'id' | 'total_usd' | 'pagado_usd'>[]
    },
    // 17: trazabilidad y corrección, solo por RPC (security definer, solo admin).
    async getTrazabilidad(id) {
      const { data, error } = await db.rpc('trazabilidad_factura', { p_factura_id: id })
      if (error) throw error
      return mapearTrazabilidad(data)
    },
    async corregirLinea(input) {
      const { data, error } = await db.rpc('corregir_linea_factura', {
        p_factura_item_id: input.factura_item_id,
        p_peso_kg: input.peso_kg,
        p_precio_usd_kg: input.precio_usd_kg,
        p_motivo: input.motivo,
      })
      if (error) throw error
      return mapearResultadoCorreccion(data)
    },

    async cambiarIva(input) {
      const { data, error } = await db.rpc('cambiar_iva_factura', {
        p_factura_id: input.factura_id,
        p_aplica_iva: input.aplica_iva,
        p_motivo: input.motivo,
      })
      if (error) throw error
      return mapearResultadoCambioIva(data)
    },
  }
}

export const facturaRepository = makeFacturaRepository()
