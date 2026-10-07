import { AppShell } from '@/components/templates/AppShell'
import { ComprasScreen } from './compras-screen'
import type { CompraFila } from '@/components/organisms/ComprasTable'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { getTasaSugerida } from '@/lib/services/compraService'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function ComprasPage() {
  const db = await createClient()
  const [compras, proveedores, productos, tasaSugerida, esAdmin] = await Promise.all([
    makeCompraRepository(db).list(),
    makeProveedorRepository(db).list({ incluirInactivos: false }),
    makeProductoRepository(db).list(),
    getTasaSugerida(db),
    requireAdmin(),
  ])

  // Costos y balances son de admin (/SPEC.md §5): al operador no le llegan
  // los importes, ni siquiera en el payload del Server Component.
  const filas: CompraFila[] = esAdmin
    ? compras
    : compras.map((c) => ({ ...c, subtotal_usd: null, pagado_usd: null }))

  return (
    <AppShell>
      <ComprasScreen
        compras={filas}
        proveedores={proveedores}
        productos={productos.filter((p) => p.activo && p.tipo === 'crudo')}
        tasaSugerida={tasaSugerida}
        esAdmin={esAdmin}
      />
    </AppShell>
  )
}
