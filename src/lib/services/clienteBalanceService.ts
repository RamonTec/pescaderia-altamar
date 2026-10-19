import type { SupabaseClient } from '@supabase/supabase-js'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { makeNotaCreditoRepository } from '@/lib/repositories/notaCreditoRepository'
import { createClient } from '@/lib/supabase/server'
import { saldoPendiente } from './creditService'

/**
 * ClienteBalanceService (SRP): cuentas por cobrar de un cliente.
 *
 * Saldo = Σ(total_usd − pagado_usd) de sus facturas `abierta`
 *       − Σ(pagado_usd − total_usd) de sus facturas `pagada` con
 *         `pagado > total` (17: saldo a favor que deja una corrección)
 *       − Σ(notas_credito.total_usd) en estado `emitida` (/SPEC.md §4.4).
 *
 * Si las notas de crédito o las correcciones dejan lo pagado por encima de lo
 * adeudado, el resultado es un saldo a favor (negativo). Se muestra, no se
 * aplica solo a otra venta. Lo consume la ficha de cliente (02-clientes).
 */
export async function getSaldoPendiente(
  clienteId: string,
  db?: SupabaseClient
): Promise<number> {
  const client = db ?? (await createClient())
  const facturas = makeFacturaRepository(client)
  const [abiertas, cerradas, notas] = await Promise.all([
    facturas.listAbiertasByCliente(clienteId),
    facturas.listCerradasByCliente(clienteId),
    makeNotaCreditoRepository(client).totalEmitidoByCliente(clienteId),
  ])

  const pendiente = saldoPendiente(
    abiertas.reduce((s, f) => s + Number(f.total_usd), 0),
    abiertas.reduce((s, f) => s + Number(f.pagado_usd), 0)
  )
  const aFavorPorCorreccion = cerradas.reduce(
    (s, f) => s + Math.max(Number(f.pagado_usd) - Number(f.total_usd), 0),
    0
  )

  return Math.round((pendiente - aFavorPorCorreccion - notas) * 1e6) / 1e6
}
