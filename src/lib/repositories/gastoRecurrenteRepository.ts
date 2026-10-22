import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  GastoRecurrenteCambios,
  GastoRecurrenteNuevo,
  IGastoRecurrenteRepository,
  ResultadoGeneracionRecurrente,
} from './interfaces'
import type { GastoRecurrente } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase de gastos recurrentes (20-gastos, Fase C).
 * Solo acceso a datos y mapeo; sin lógica de negocio.
 */

function normaliza(fila: Record<string, unknown>): GastoRecurrente {
  return {
    id: String(fila.id),
    nombre: String(fila.nombre),
    categoria_id: String(fila.categoria_id),
    empleado_id: fila.empleado_id ? String(fila.empleado_id) : null,
    descripcion: String(fila.descripcion),
    beneficiario: fila.beneficiario ? String(fila.beneficiario) : null,
    moneda: fila.moneda as GastoRecurrente['moneda'],
    monto: fila.monto !== null && fila.monto !== undefined ? Number(fila.monto) : null,
    frecuencia: fila.frecuencia as GastoRecurrente['frecuencia'],
    dia_mes: fila.dia_mes !== null && fila.dia_mes !== undefined ? Number(fila.dia_mes) : null,
    fecha_inicio: String(fila.fecha_inicio),
    fecha_fin: fila.fecha_fin ? String(fila.fecha_fin) : null,
    metodo_pago: fila.metodo_pago ? (fila.metodo_pago as GastoRecurrente['metodo_pago']) : null,
    activo: Boolean(fila.activo),
    created_at: String(fila.created_at),
    created_by: String(fila.created_by),
    updated_at: String(fila.updated_at),
    updated_by: fila.updated_by ? String(fila.updated_by) : null,
    categoria_nombre: (fila.categorias_gasto as { nombre?: string } | null)?.nombre ?? null,
    empleado_nombre: (fila.empleados as { nombre?: string } | null)?.nombre ?? null,
  }
}

export function makeGastoRecurrenteRepository(
  db: SupabaseClient = createClient()
): IGastoRecurrenteRepository {
  return {
    async list() {
      const { data, error } = await db
        .from('gastos_recurrentes')
        .select('*, categorias_gasto(nombre), empleados(nombre)')
        .order('activo', { ascending: false })
        .order('nombre', { ascending: true })
      if (error) throw error
      return ((data ?? []) as Record<string, unknown>[]).map(normaliza)
    },

    async getById(id: string) {
      const { data, error } = await db
        .from('gastos_recurrentes')
        .select('*, categorias_gasto(nombre), empleados(nombre)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data ? normaliza(data as Record<string, unknown>) : null
    },

    async create(input: GastoRecurrenteNuevo) {
      const { data, error } = await db
        .from('gastos_recurrentes')
        .insert(input)
        .select('*, categorias_gasto(nombre), empleados(nombre)')
        .single()
      if (error) throw error
      return normaliza(data as Record<string, unknown>)
    },

    async update(id: string, cambios: GastoRecurrenteCambios) {
      const { data, error } = await db
        .from('gastos_recurrentes')
        .update(cambios)
        .eq('id', id)
        .select('*, categorias_gasto(nombre), empleados(nombre)')
        .single()
      if (error) throw error
      return normaliza(data as Record<string, unknown>)
    },

    async generar(hasta?: string) {
      const { data, error } = await db.rpc('generar_gastos_recurrentes', {
        p_hasta: hasta ?? null,
      })
      if (error) throw error
      return (data ?? { generados: 0, por_recurrente: [] }) as ResultadoGeneracionRecurrente
    },
  }
}
