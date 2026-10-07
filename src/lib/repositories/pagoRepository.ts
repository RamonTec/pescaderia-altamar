import type { SupabaseClient } from '@supabase/supabase-js'
import type { IPagoRepository, PagoNuevo } from './interfaces'
import type { Pago } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de pagos (cobros de facturas).
 * La escritura va por RPC `registrar_pago` (0014): inserta el pago y actualiza
 * `facturas.pagado_usd`/`estado` en una sola transacción con bloqueo de fila.
 */
export function makePagoRepository(db: SupabaseClient = createClient()): IPagoRepository {
  return {
    async create(pago: PagoNuevo) {
      const { data, error } = await db.rpc('registrar_pago', { p_pago: pago })
      if (error) throw error
      return data as string
    },
    async listByFactura(facturaId) {
      const { data, error } = await db
        .from('pagos')
        .select('*')
        .eq('factura_id', facturaId)
        .order('fecha', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Pago[]
    },
  }
}

export const pagoRepository = makePagoRepository()
