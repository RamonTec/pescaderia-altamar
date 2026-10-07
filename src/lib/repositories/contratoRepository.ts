import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ContratoActivoDuplicadoError,
  type ContratoActivoOrigen,
  type IContratoRepository,
  type OrigenContrato,
} from './interfaces'
import type { Contrato, ContratoListado } from '@/types/domain'

/**
 * Implementación Supabase del repositorio de contratos (06-contratos). Solo
 * acceso a datos: tabla `contratos` y vista `contratos_listado_view`
 * (security_invoker, hereda la RLS solo admin). Sin lógica de negocio.
 */

const SELECT_ACTIVO = 'id, numero, estado, factura_id, compra_id'

/** Quita comodines y separadores de PostgREST de la búsqueda libre. */
function limpiarBusqueda(texto: string): string {
  return texto.replace(/[%_,()*\\]/g, '').trim().toLowerCase()
}

function normalizaContrato<T extends Contrato>(fila: T): T {
  return { ...fila, numero: Number(fila.numero) }
}

function normalizaListado(fila: ContratoListado): ContratoListado {
  return {
    ...normalizaContrato(fila),
    documento_numero: fila.documento_numero === null ? null : Number(fila.documento_numero),
    monto_usd: fila.monto_usd === null ? null : Number(fila.monto_usd),
    origen_anulado: Boolean(fila.origen_anulado),
  }
}

function normalizaActivo(fila: ContratoActivoOrigen): ContratoActivoOrigen {
  return { ...fila, numero: Number(fila.numero) }
}

export function makeContratoRepository(db: SupabaseClient): IContratoRepository {
  async function origenes(tabla: 'facturas' | 'compras', ids: string[]): Promise<OrigenContrato[]> {
    if (ids.length === 0) return []
    const { data, error } = await db.from(tabla).select('id, condicion, estado').in('id', ids)
    if (error) throw error
    return (data ?? []) as OrigenContrato[]
  }

  return {
    async siguienteNumero() {
      const { data, error } = await db.rpc('siguiente_numero_contrato')
      if (error) throw error
      return Number(data)
    },

    async create(contrato) {
      const { data, error } = await db.from('contratos').insert(contrato).select('*').single()
      if (error) {
        if (error.code === '23505') throw new ContratoActivoDuplicadoError()
        throw error
      }
      return normalizaContrato(data as Contrato)
    },

    async getById(id) {
      const { data, error } = await db.from('contratos').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data ? normalizaContrato(data as Contrato) : null
    },

    async list(filtros) {
      let q = db.from('contratos_listado_view').select('*', { count: 'exact' })
      if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
      if (filtros.estado === 'activos') q = q.neq('estado', 'anulado')
      else if (filtros.estado !== 'todos') q = q.eq('estado', filtros.estado)
      const texto = limpiarBusqueda(filtros.q ?? '')
      if (texto) q = q.ilike('busqueda', `%${texto}%`)

      const desde = filtros.page * filtros.pageSize
      const { data, error, count } = await q
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false })
        .range(desde, desde + filtros.pageSize - 1)
      if (error) throw error
      return { rows: ((data ?? []) as ContratoListado[]).map(normalizaListado), total: count ?? 0 }
    },

    async activosPorFacturas(ids) {
      if (ids.length === 0) return []
      const { data, error } = await db
        .from('contratos')
        .select(SELECT_ACTIVO)
        .in('factura_id', ids)
        .neq('estado', 'anulado')
      if (error) throw error
      return ((data ?? []) as ContratoActivoOrigen[]).map(normalizaActivo)
    },

    async activosPorCompras(ids) {
      if (ids.length === 0) return []
      const { data, error } = await db
        .from('contratos')
        .select(SELECT_ACTIVO)
        .in('compra_id', ids)
        .neq('estado', 'anulado')
      if (error) throw error
      return ((data ?? []) as ContratoActivoOrigen[]).map(normalizaActivo)
    },

    async updateEstado(id, estado) {
      const { data, error } = await db
        .from('contratos')
        .update({ estado })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return normalizaContrato(data as Contrato)
    },

    origenesFacturas(ids) {
      return origenes('facturas', ids)
    },

    origenesCompras(ids) {
      return origenes('compras', ids)
    },
  }
}
