import { ComprasScreen } from './compras-screen'
import type { CompraFila } from '@/components/organisms/ComprasTable'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { makeLoteRepository } from '@/lib/repositories/loteRepository'
import { getConfigTasas } from '@/lib/services/tasaService'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'
import { elegibilidadCompras } from '@/lib/services/contratoService'
import type { Compra } from '@/types/domain'

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const page = Math.max(0, (Number(params.pagina) || 1) - 1)
  const pageSize = Number(params.limit) || 25
  const q = typeof params.q === 'string' ? params.q : undefined
  const estado = typeof params.estado === 'string' ? params.estado : undefined

  const db = await createClient()
  const [paginaCompras, proveedores, productos, configTasas, esAdmin] = await Promise.all([
    makeCompraRepository(db).list({
      page,
      pageSize,
      q,
      estado: estado as Compra['estado'] | 'todas' | undefined,
    }),
    makeProveedorRepository(db).list({ incluirInactivos: false }),
    makeProductoRepository(db).list(),
    getConfigTasas(db),
    requireAdmin(),
  ])

  // Códigos de lote de cada compra (07-lotes), para los chips del listado, y
  // elegibilidad de contrato de las filas de la página (06-contratos, solo
  // admin, en lote: paginar cambia la elegibilidad sin consultas por fila).
  const compraIds = paginaCompras.rows.map((c) => c.id)
  const [lotes, contratos] = await Promise.all([
    makeLoteRepository(db).listByOrigen({ compraIds }),
    esAdmin && compraIds.length > 0
      ? elegibilidadCompras(compraIds).then((m) => Object.fromEntries(m))
      : Promise.resolve({}),
  ])
  const lotesPorCompra = new Map<string, string[]>()
  for (const l of lotes) {
    if (!l.compra_id) continue
    lotesPorCompra.set(l.compra_id, [...(lotesPorCompra.get(l.compra_id) ?? []), l.codigo])
  }

  // Costos y balances son de admin (/SPEC.md §5): al operador no le llegan
  // los importes, ni siquiera en el payload del Server Component.
  const filas: CompraFila[] = paginaCompras.rows.map((c) => ({
    ...c,
    ...(esAdmin ? {} : { subtotal_usd: null, pagado_usd: null }),
    lotes: lotesPorCompra.get(c.id) ?? [],
  }))

  return (
    <ComprasScreen
      compras={filas}
      total={paginaCompras.total}
      proveedores={proveedores}
      productos={productos.filter((p) => p.activo && p.tipo === 'crudo')}
      configTasas={configTasas}
      esAdmin={esAdmin}
      contratos={contratos}
    />
  )
}