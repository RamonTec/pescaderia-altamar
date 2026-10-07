import { ProveedoresScreen } from './proveedores-screen'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'
import { getSaldoPendiente } from '@/lib/services/proveedorBalanceService'

export default async function ProveedoresPage() {
  const db = await createClient()
  const [proveedores, esAdmin] = await Promise.all([
    makeProveedorRepository(db).listConResumen(),
    requireAdmin(),
  ])

  // Saldo pendiente real por proveedor (04-inventario): las compras abiertas
  // Σ(subtotal − pagado). Sin compras abiertas el saldo es $0, no null.
  const saldos: Record<string, number> = {}
  await Promise.all(
    proveedores.map(async (p) => {
      saldos[p.id] = await getSaldoPendiente(p.id, db)
    })
  )

  return <ProveedoresScreen proveedores={proveedores} esAdmin={esAdmin} saldos={saldos} />
}