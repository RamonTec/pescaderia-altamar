import { ProcesamientoScreen } from './procesamiento-screen'
import type { ProcesoFila } from '@/components/organisms/ProcesamientosTable'
import type { CrudoConStock } from '@/components/organisms/ProcesamientoForm'
import { makeProcesamientoRepository } from '@/lib/repositories/procesamientoRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { getStocks } from '@/lib/services/costingService'
import { requireAdmin } from '@/lib/services/authService'
import { createClient } from '@/lib/supabase/server'

export default async function ProcesamientoPage() {
  const db = await createClient()
  const [procesamientos, productos, stocks, esAdmin] = await Promise.all([
    makeProcesamientoRepository(db).list(),
    makeProductoRepository(db).list(),
    getStocks(db),
    requireAdmin(),
  ])

  // Costos son de admin (/SPEC.md §5): `proceso_items.costo_total_usd` sigue
  // legible por RLS, así que se quita aquí y no llega al payload del operador.
  const filas: ProcesoFila[] = procesamientos.flatMap((p) =>
    p.proceso_items.map((i) => ({
      id: i.id,
      fecha: p.fecha,
      notas: p.notas,
      origen: i.origen,
      destino: i.destino,
      peso_entrada_kg: i.peso_entrada_kg,
      peso_salida_kg: i.peso_salida_kg,
      costo_total_usd: esAdmin ? i.costo_total_usd : null,
    }))
  )

  const activos = productos.filter((p) => p.activo)
  const crudos: CrudoConStock[] = activos
    .filter((p) => p.tipo === 'crudo')
    .map((p) => {
      const s = stocks.get(p.id)
      return {
        producto: p,
        stock_kg: s?.stock_kg ?? 0,
        costo_usd_kg: esAdmin ? (s?.costo_usd_kg ?? 0) : null,
      }
    })

  return (
    <ProcesamientoScreen
      filas={filas}
      crudos={crudos}
      procesados={activos.filter((p) => p.tipo === 'procesado')}
      esAdmin={esAdmin}
    />
  )
}
