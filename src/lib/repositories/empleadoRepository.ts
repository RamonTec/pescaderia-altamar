import type { SupabaseClient } from '@supabase/supabase-js'
import type { IEmpleadoRepository, PagoNominaCosto } from './interfaces'
import type { Empleado, RangoFechas } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase de los empleados (20-gastos, Fase B). Escritura
 * directa en `empleados` bajo RLS `es_admin()`. Solo acceso y mapeo
 * `numeric → number`: los errores (con su `code`) se devuelven tal cual.
 * El costo lee los pagos de nómina (`gastos` con `empleado_id`) sin agregar:
 * la suma la hace el servicio.
 */

/** Tamaño de página de PostgREST (`max-rows` por defecto de Supabase). */
const LOTE = 1000

const COLUMNAS_PAGO = 'empleado_id, fecha, monto_usd, tasa_snapshot'

function normaliza(fila: Empleado): Empleado {
  return { ...fila, salario_base: Number(fila.salario_base), activo: Boolean(fila.activo) }
}

function normalizaPago(fila: Record<string, unknown>): PagoNominaCosto {
  return {
    empleado_id: String(fila.empleado_id),
    fecha: String(fila.fecha),
    monto_usd: Number(fila.monto_usd),
    tasa_snapshot: fila.tasa_snapshot === null || fila.tasa_snapshot === undefined ? null : Number(fila.tasa_snapshot),
  }
}

export function makeEmpleadoRepository(db: SupabaseClient = createClient()): IEmpleadoRepository {
  async function pagos(rango: RangoFechas, empleadoId?: string): Promise<PagoNominaCosto[]> {
    const filas: PagoNominaCosto[] = []
    for (let desde = 0; ; desde += LOTE) {
      let q = db
        .from('gastos')
        .select(COLUMNAS_PAGO)
        .eq('estado', 'confirmado')
        .not('empleado_id', 'is', null)
        .gte('fecha', rango.desde)
        .lte('fecha', rango.hasta)
        .order('fecha', { ascending: true })
        .order('id', { ascending: true })
        .range(desde, desde + LOTE - 1)
      if (empleadoId) q = q.eq('empleado_id', empleadoId)
      const { data, error } = await q
      if (error) throw error
      const pagina = (data ?? []) as Record<string, unknown>[]
      filas.push(...pagina.map(normalizaPago))
      if (pagina.length < LOTE) break
    }
    return filas
  }

  return {
    async list() {
      const { data, error } = await db
        .from('empleados')
        .select('*')
        .order('nombre', { ascending: true })
        .order('id', { ascending: true })
      if (error) throw error
      return ((data ?? []) as Empleado[]).map(normaliza)
    },

    async getById(id) {
      const { data, error } = await db.from('empleados').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data ? normaliza(data as Empleado) : null
    },

    async create(data) {
      const { data: fila, error } = await db.from('empleados').insert(data).select('*').single()
      if (error) throw error
      return normaliza(fila as Empleado)
    },

    async update(id, cambios) {
      const { data, error } = await db.from('empleados').update(cambios).eq('id', id).select('*').single()
      if (error) throw error
      return normaliza(data as Empleado)
    },

    costo: (id, rango) => pagos(rango, id),

    pagosDelRango: (rango) => pagos(rango),
  }
}
