import type { SupabaseClient } from '@supabase/supabase-js'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { makeNotaCreditoRepository } from '@/lib/repositories/notaCreditoRepository'
import { createClient } from '@/lib/supabase/server'
import { saldoPendiente } from './creditService'

/**
 * ClienteBalanceService (SRP): cuentas por cobrar de un cliente.
 *
 * Saldo = Σ(total_usd − pagado_usd) de sus facturas `abierta`
 *       − Σ(notas_credito.total_usd) en estado `emitida` asociadas a esas
 *         facturas (/SPEC.md §4.4).
 *
 * Si las notas de crédito superan lo adeudado (factura ya pagada + devolución),
 * el resultado es un saldo a favor (negativo). Lo consume la ficha de cliente
 * (02-clientes).
 */
export async function getSaldoPendiente(
  clienteId: string,
  db?: SupabaseClient
): Promise<number> {
  const client = db ?? (await createClient())
  const [abiertas, notas] = await Promise.all([
    makeFacturaRepository(client).listAbiertasByCliente(clienteId),
    makeNotaCreditoRepository(client).totalEmitidoByCliente(clienteId),
  ])

  const pendiente = saldoPendiente(
    abiertas.reduce((s, f) => s + Number(f.total_usd), 0),
    abiertas.reduce((s, f) => s + Number(f.pagado_usd), 0)
  )

  return Math.round((pendiente - notas) * 1e6) / 1e6
}
