import { ProcesamientoScreen } from './procesamiento-screen'
import type { ProcesoFila } from '@/components/organisms/ProcesamientosTable'
import type { CrudoConStock } from '@/components/organisms/ProcesamientoForm'
import { makeProcesamientoRepository } from '@/lib/repositories/procesamientoRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { makeLoteRepository } from '@/lib/repositories/loteRepository'
import { getConfigNegocio } from '@/lib/services/configService'
import { requireAdmin } from '@/lib/services/authService'
import { createClient } from '@/lib/supabase/server'

export default async function ProcesamientoPage() {
  const db = await createClient()
  const loteRepo = makeLoteRepository(db)
  const [procesamientos, productos, lotesAbiertos, config, esAdmin] = await Promise.all([
    makeProcesamientoRepository(db).list(),
    makeProductoRepository(db).list(),
    loteRepo.listAbiertosTodos(),
    getConfigNegocio(db),
    requireAdmin(),
  ])

  // Lote procesado generado por cada línea (y su lote crudo padre).
  const lotesGenerados = await loteRepo.listByOrigen({
    procesamientoIds: procesamientos.map((p) => p.id),
  })
  const porProcesoItem = new Map(
    lotesGenerados.filter((l) => l.proceso_item_id).map((l) => [l.proceso_item_id as string, l])
  )

  // Costos son de admin (/SPEC.md §5): `proceso_items.costo_total_usd` sigue
  // legible por RLS, así que se quita aquí y no llega al payload del operador.
  const filas: ProcesoFila[] = procesamientos.flatMap((p) =>
    p.proceso_items.map((i) => {
      const generado = porProcesoItem.get(i.id)
      return {
        id: i.id,
        fecha: p.fecha,
        notas: p.notas,
        origen: i.origen,
        destino: i.destino,
        peso_entrada_kg: i.peso_entrada_kg,
        peso_salida_kg: i.peso_salida_kg,
        costo_total_usd: esAdmin ? i.costo_total_usd : null,
        lote_origen_codigo: generado?.lote_padre_codigo ?? null,
        lote_destino_codigo: generado?.codigo ?? null,
      }
    })
  )

  const activos = productos.filter((p) => p.activo)
  const crudosIds = new Set(activos.filter((p) => p.tipo === 'crudo').map((p) => p.id))
  // Lotes crudos abiertos con stock, en PEPS (ya llegan ordenados).
  const lotes = lotesAbiertos.filter((l) => crudosIds.has(l.producto_id) && l.stock_kg > 0)

  const crudos: CrudoConStock[] = activos
    .filter((p) => p.tipo === 'crudo')
    .map((p) => ({
      producto: p,
      stock_kg:
        Math.round(
          lotes.filter((l) => l.producto_id === p.id).reduce((s, l) => s + l.stock_kg, 0) * 1000
        ) / 1000,
    }))

  return (
    <ProcesamientoScreen
      filas={filas}
      crudos={crudos}
      procesados={activos.filter((p) => p.tipo === 'procesado')}
      lotes={lotes}
      diasAlertaLote={config?.dias_alerta_lote ?? null}
      esAdmin={esAdmin}
    />
  )
}
