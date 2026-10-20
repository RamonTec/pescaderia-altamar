import type { SupabaseClient } from '@supabase/supabase-js'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { createClient } from '@/lib/supabase/server'
import { saldoPendiente } from './creditService'

/**
 * ProveedorBalanceService (SRP): cuentas por pagar de un proveedor.
 *
 * Saldo = Σ(subtotal_usd − pagado_usd) de sus compras `abierta`
 *       − Σ(pagado_usd − subtotal_usd) de sus compras `pagada` con
 *         `pagado > subtotal` (19: saldo a favor que deja una edición).
 *
 * Si los saldos a favor superan lo pendiente, el resultado es negativo: un
 * saldo a favor del negocio con el proveedor. Se muestra, no se aplica solo
 * a otra compra. Lo consume la ficha de proveedor (03-proveedores).
 */
export async function getSaldoPendiente(
  proveedorId: string,
  db?: SupabaseClient
): Promise<number> {
  const client = db ?? (await createClient())
  const repo = makeCompraRepository(client)
  const [abiertas, pagadas] = await Promise.all([
    repo.listAbiertasByProveedor(proveedorId),
    repo.listPagadasByProveedor(proveedorId),
  ])
  const pendiente = saldoPendiente(
    abiertas.reduce((s, c) => s + Number(c.subtotal_usd), 0),
    abiertas.reduce((s, c) => s + Number(c.pagado_usd), 0)
  )
  return Math.round((pendiente - saldoAFavor(pagadas)) * 1e6) / 1e6
}

/** Σ de lo pagado por encima del total (≥ 0) en compras ya pagadas. */
export function saldoAFavor(compras: readonly { subtotal_usd: number; pagado_usd: number }[]): number {
  return compras.reduce((s, c) => s + Math.max(Number(c.pagado_usd) - Number(c.subtotal_usd), 0), 0)
}
