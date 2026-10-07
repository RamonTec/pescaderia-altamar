import { InventarioScreen } from './inventario-screen'
import { paginaDesdeParam } from '@/components/organisms/AppDataGrid'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { getInventarioPorLotes } from '@/lib/services/costingService'
import { listarLotes } from '@/lib/services/loteService'
import { getConfigNegocio } from '@/lib/services/configService'
import { getTasaVigente } from '@/lib/services/tasaService'
import { requireAdmin } from '@/lib/services/authService'
import { createClient } from '@/lib/supabase/server'
import { fechaHoy } from '@/lib/format'

/** Tamaño de la primera página (el de `AppDataGrid` por defecto). */
const PAGE_SIZE = 25

/**
 * Inventario por lotes (07-lotes; reemplaza el placeholder y las tareas
 * 16–19 de 04-inventario): pestaña Productos (stock, lotes abiertos, lote más
 * antiguo, valor solo admin) y pestaña Lotes (paginación en servidor). Todo
 * se carga aquí en paralelo; costos e importes solo le llegan al admin.
 */
export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const db = await createClient()
  const [esAdmin, config, productos, proveedores] = await Promise.all([
    requireAdmin(),
    getConfigNegocio(db),
    makeProductoRepository(db).list(),
    makeProveedorRepository(db).list({ incluirInactivos: true }),
  ])

  const fuente = config?.fuente_tasa_default ?? 'bcv'
  const [tasa, inventario, primeraPagina] = await Promise.all([
    esAdmin ? getTasaVigente(fechaHoy(), fuente, 'USD', db).catch(() => null) : Promise.resolve(null),
    getInventarioPorLotes(null, db, config?.umbral_stock_bajo_kg ?? null),
    listarLotes(
      { estado: 'abierto', page: paginaDesdeParam(params.pagina), pageSize: PAGE_SIZE },
      db
    ),
  ])

  const bsPorUsd = tasa ? Number(tasa.tasa.valor_bs) : null
  // Valor en Bs a la tasa vigente; el operador no recibe importes ni costos.
  const items = inventario.items.map((i) => ({
    ...i,
    valor_usd: esAdmin ? i.valor_usd : null,
    costo_promedio_usd_kg: esAdmin ? i.costo_promedio_usd_kg : null,
    valor_bs: esAdmin && i.valor_usd != null && bsPorUsd ? i.valor_usd * bsPorUsd : null,
    lotes: esAdmin ? i.lotes : i.lotes.map((l) => ({ ...l, costo_usd_kg: null })),
  }))
  const totalUsd = esAdmin ? inventario.total_usd : null

  return (
    <InventarioScreen
      productos={items}
      totalUsd={totalUsd}
      totalBs={totalUsd != null && bsPorUsd ? totalUsd * bsPorUsd : null}
      tasaBs={esAdmin ? bsPorUsd : null}
      fuenteTasa={fuente}
      lotesIniciales={{
        rows: esAdmin ? primeraPagina.rows : primeraPagina.rows.map((l) => ({ ...l, costo_usd_kg: null })),
        total: primeraPagina.total,
      }}
      catalogoProductos={productos.filter((p) => p.controla_stock)}
      proveedores={proveedores}
      diasAlertaLote={config?.dias_alerta_lote ?? null}
      esAdmin={esAdmin}
      tabInicial={params.tab === 'lotes' ? 'lotes' : 'productos'}
    />
  )
}
