import type { SupabaseClient } from '@supabase/supabase-js'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { createClient } from '@/lib/supabase/server'
import { saldoPendiente } from './creditService'

/**
 * ProveedorBalanceService (SRP): cuentas por pagar de un proveedor.
 * Saldo = Σ(subtotal_usd − pagado_usd) de sus compras `abierta`.
 * Lo consume la ficha de proveedor (03-proveedores).
 */
export async function getSaldoPendiente(
  proveedorId: string,
  db?: SupabaseClient
): Promise<number> {
  const client = db ?? (await createClient())
  const abiertas = await makeCompraRepository(client).listAbiertasByProveedor(proveedorId)
  return saldoPendiente(
    abiertas.reduce((s, c) => s + Number(c.subtotal_usd), 0),
    abiertas.reduce((s, c) => s + Number(c.pagado_usd), 0)
  )
}
