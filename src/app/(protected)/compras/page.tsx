import { ComprasScreen } from './compras-screen'
import type { CompraFila } from '@/components/organisms/ComprasTable'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { getConfigTasas } from '@/lib/services/tasaService'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function ComprasPage() {
  const db = await createClient()
  const [compras, proveedores, productos, configTasas, esAdmin] = await Promise.all([
    makeCompraRepository(db).list(),
    makeProveedorRepository(db).list({ incluirInactivos: false }),
    makeProductoRepository(db).list(),
    getConfigTasas(db),
    requireAdmin(),
  ])

  // Costos y balances son de admin (/SPEC.md §5): al operador no le llegan
  // los importes, ni siquiera en el payload del Server Component.
  const filas: CompraFila[] = esAdmin
    ? compras
    : compras.map((c) => ({ ...c, subtotal_usd: null, pagado_usd: null }))

  return (
    <ComprasScreen
      compras={filas}
      proveedores={proveedores}
      productos={productos.filter((p) => p.activo && p.tipo === 'crudo')}
      configTasas={configTasas}
      esAdmin={esAdmin}
    />
  )
}