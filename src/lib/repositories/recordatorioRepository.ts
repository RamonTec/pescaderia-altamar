import type { SupabaseClient } from '@supabase/supabase-js'
import type { IRecordatorioRepository } from './interfaces'
import type { RecordatorioCobro } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de recordatorios de cobro
 * (09-cuentas-por-cobrar). Lectura por `recordatorios_cobro_view` (el texto
 * llega `null` al operador); escritura por la RPC `registrar_recordatorio_cobro`
 * (recordatorio + facturas en una transacción, solo admin).
 */
export function makeRecordatorioRepository(
  db: SupabaseClient = createClient()
): IRecordatorioRepository {
  return {
    async registrar(recordatorio, facturaIds) {
      const { data, error } = await db.rpc('registrar_recordatorio_cobro', {
        p_recordatorio: recordatorio,
        p_factura_ids: facturaIds,
      })
      if (error) throw error
      return data as string
    },
    async listByCliente(clienteId) {
      const { data, error } = await db
        .from('recordatorios_cobro_view')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as RecordatorioCobro[]
    },
    async ultimoPorCliente(clienteId) {
      const { data, error } = await db
        .from('recordatorios_cobro_view')
        .select('*')
        .eq('cliente_id', clienteId)
        .neq('estado', 'fallido')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as RecordatorioCobro | null) ?? null
    },
    async getById(id) {
      const { data, error } = await db
        .from('recordatorios_cobro_view')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return (data as RecordatorioCobro | null) ?? null
    },
  }
}
