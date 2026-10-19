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
  const [procesamientos, productos, lotesAbiertos, config, esAdmin] = await Promise.all([
    makeProcesamientoRepository(db).list(),
    makeProductoRepository(db).list(),
    makeLoteRepository(db).listAbiertosTodos(),
    getConfigNegocio(db),
    requireAdmin(),
  ])

  // Una fila por procesamiento (16). Los costos llegan `null` al operador
  // desde las vistas (`procesamientos_view` / `proceso_items_view`).
  const filas: ProcesoFila[] = procesamientos.map((p) => {
    const salidaTotal =
      p.proceso_items.reduce((s, i) => s + Math.round(i.peso_salida_kg * 1000), 0) / 1000
    // Registros legados sin cabecera: la entrada es la suma de sus líneas.
    const entrada =
      p.peso_entrada_kg ??
      p.proceso_items.reduce((s, i) => s + Math.round(i.peso_entrada_kg * 1000), 0) / 1000
    const primera = p.proceso_items[0]
    return {
      id: p.id,
      fecha: p.fecha,
      notas: p.notas,
      origen_nombre: p.origen?.nombre ?? primera?.origen.nombre ?? '—',
      lote_origen_id: p.lote_origen_id ?? primera?.lote_origen_id ?? null,
      lote_origen_codigo: p.lote_origen_codigo,
      peso_entrada_kg: entrada,
      salida_total_kg: salidaTotal,
      costo_total_usd: p.costo_total_usd,
      salidas: p.proceso_items.map((i) => ({
        id: i.id,
        producto_nombre: i.destino.nombre,
        peso_salida_kg: i.peso_salida_kg,
        lote_destino_id: i.lote_destino_id,
        lote_destino_codigo: i.lote_destino_codigo,
        costo_usd_kg:
          i.costo_total_usd != null && i.peso_salida_kg > 0
            ? Math.round((i.costo_total_usd / i.peso_salida_kg) * 1e6) / 1e6
            : null,
      })),
    }
  })

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
