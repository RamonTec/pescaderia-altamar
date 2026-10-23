import type { SupabaseClient } from '@supabase/supabase-js'
import type { ICotizacionRepository } from './interfaces'
import type { Cotizacion, CotizacionDetalle, CotizacionItem, CotizacionListado } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase de las cotizaciones (21-cotizaciones). Lectura bajo
 * RLS `authenticated` (admin y operador, P4); escritura de cabecera + líneas
 * por la RPC `guardar_cotizacion` y cambios de estado por `update` (los
 * controla `cotizaciones_guard`). Solo acceso y mapeo `numeric → number`.
 */

const num = (v: unknown): number => Number(v ?? 0)

/** Quita los caracteres con significado en los filtros de PostgREST. */
function limpiarBusqueda(texto: string): string {
  return texto.replace(/[%_,()*\\.:"]/g, '').trim()
}

function normalizaCotizacion<T extends Cotizacion>(f: T): T {
  return {
    ...f,
    numero: num(f.numero),
    validez_dias: num(f.validez_dias),
    iva_pct: num(f.iva_pct),
    subtotal_usd: num(f.subtotal_usd),
    descuento_usd: num(f.descuento_usd),
    iva_usd: num(f.iva_usd),
    total_usd: num(f.total_usd),
  }
}

function normalizaItem(f: CotizacionItem): CotizacionItem {
  return {
    ...f,
    orden: num(f.orden),
    peso_kg: num(f.peso_kg),
    precio_usd_kg: num(f.precio_usd_kg),
    subtotal_usd: num(f.subtotal_usd),
  }
}

function normalizaListado(f: CotizacionListado): CotizacionListado {
  return { ...f, numero: num(f.numero), total_usd: num(f.total_usd), n_lineas: num(f.n_lineas) }
}

const COLUMNAS_LISTADO =
  'id, numero, fecha, fecha_vencimiento, estado, estado_efectivo, cliente_id, cliente, telefono, total_usd, n_lineas, enviada_at, updated_at, tiene_enlace, pedido_id'

interface NombresUsuarios {
  creado_por_nombre: string | null
  enviada_por_nombre: string | null
  respondida_por_nombre: string | null
  anulada_por_nombre: string | null
  actualizado_por_nombre: string | null
  token_generado_por_nombre: string | null
}

export function makeCotizacionRepository(db: SupabaseClient = createClient()): ICotizacionRepository {
  async function getById(id: string): Promise<Cotizacion | null> {
    const { data, error } = await db.from('cotizaciones').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? normalizaCotizacion(data as Cotizacion) : null
  }

  return {
    async listar(filtros) {
      let q = db.from('cotizaciones_listado_view').select(COLUMNAS_LISTADO, { count: 'exact' })
      if (filtros.estado === 'abiertas') q = q.in('estado_efectivo', ['borrador', 'enviada'])
      else if (filtros.estado !== 'todas') q = q.eq('estado_efectivo', filtros.estado)
      if (filtros.desde) q = q.gte('fecha', filtros.desde)
      if (filtros.hasta) q = q.lte('fecha', filtros.hasta)

      const texto = limpiarBusqueda(filtros.texto ?? '')
      const condiciones: string[] = []
      if (filtros.numero !== undefined) condiciones.push(`numero.eq.${filtros.numero}`)
      if (texto) condiciones.push(`busqueda.ilike.*${texto}*`)
      if (condiciones.length > 0) q = q.or(condiciones.join(','))

      const desde = filtros.pagina * filtros.tamano
      const { data, error, count } = await q
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false })
        .range(desde, desde + filtros.tamano - 1)
      if (error) throw error
      return { rows: ((data ?? []) as unknown as CotizacionListado[]).map(normalizaListado), total: count ?? 0 }
    },

    getById,

    async getDetalle(id) {
      const cot = await getById(id)
      if (!cot) return null

      const [items, cliente, usuarios] = await Promise.all([
        db.from('cotizacion_items').select('*').eq('cotizacion_id', id).order('orden'),
        cot.cliente_id
          ? db
              .from('clientes')
              .select('id, nombre, rif_ci, telefono, aplica_iva, bloqueado')
              .eq('id', cot.cliente_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        db
          .from('cotizaciones_usuarios_view')
          .select(
            'creado_por_nombre, enviada_por_nombre, respondida_por_nombre, anulada_por_nombre, actualizado_por_nombre, token_generado_por_nombre'
          )
          .eq('id', id)
          .maybeSingle(),
      ])
      if (items.error) throw items.error
      if (cliente.error) throw cliente.error
      if (usuarios.error) throw usuarios.error
      const nombres = (usuarios.data ?? {}) as Partial<NombresUsuarios>

      const detalle: CotizacionDetalle = {
        ...cot,
        items: ((items.data ?? []) as CotizacionItem[]).map(normalizaItem),
        cliente: (cliente.data as CotizacionDetalle['cliente']) ?? null,
        creado_por_nombre: nombres.creado_por_nombre ?? null,
        enviada_por_nombre: nombres.enviada_por_nombre ?? null,
        respondida_por_nombre: nombres.respondida_por_nombre ?? null,
        anulada_por_nombre: nombres.anulada_por_nombre ?? null,
        actualizado_por_nombre: nombres.actualizado_por_nombre ?? null,
        token_generado_por_nombre: nombres.token_generado_por_nombre ?? null,
      }
      return detalle
    },

    async guardar(id, cabecera, items) {
      const { data, error } = await db.rpc('guardar_cotizacion', {
        p_id: id,
        p_cabecera: cabecera,
        p_items: items,
      })
      if (error) throw error
      return data as string
    },

    async cambiarToken(id, token) {
      const { data, error } = await db
        .from('cotizaciones')
        .update({ token_publico: token })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return normalizaCotizacion(data as Cotizacion)
    },

    async convertirEnPedido(id, fechaEntrega) {
      const { data, error } = await db.rpc('convertir_cotizacion_en_pedido', {
        p_id: id,
        p_fecha_entrega: fechaEntrega,
      })
      if (error) throw error
      return data as string
    },

    async cambiarEstado(id, cambio) {
      const { data, error } = await db.from('cotizaciones').update(cambio).eq('id', id).select('*').single()
      if (error) throw error
      return normalizaCotizacion(data as Cotizacion)
    },
  }
}
