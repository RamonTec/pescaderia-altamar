import { cache } from 'react'
import type { DiasFlujo } from '@/types/domain'
import type { Rol } from '@/lib/services/authService'
import {
  DIAS_INACTIVIDAD,
  getAnalitica,
  getCartera,
  getKpisDia,
  getOperativo,
  getTasasDelDia,
} from '@/lib/services/dashboardService'
import { KpisDiaRow } from '@/components/organisms/KpisDiaRow'
import { PedidosProximosList } from '@/components/organisms/PedidosProximosList'
import { AntiguedadLotesChart } from '@/components/organisms/AntiguedadLotesChart'
import { VentasMensualesChart } from '@/components/organisms/VentasMensualesChart'
import { ResultadoCambiarioCard } from '@/components/organisms/ResultadoCambiarioCard'
import { ProductosSalidaTable } from '@/components/organisms/ProductosSalidaTable'
import { SpreadPrecioCostoChart } from '@/components/organisms/SpreadPrecioCostoChart'
import { MezclaVentasPanel } from '@/components/organisms/MezclaVentasPanel'
import { MermaProcesosPanel } from '@/components/organisms/MermaProcesosPanel'
import { PerdidasMotivoChart } from '@/components/organisms/PerdidasMotivoChart'
import { RendimientoProveedorTable } from '@/components/organisms/RendimientoProveedorTable'
import { ValorInventarioPanel } from '@/components/organisms/ValorInventarioPanel'
import { AgingCarteraChart } from '@/components/organisms/AgingCarteraChart'
import { TopDeudoresList } from '@/components/organisms/TopDeudoresList'
import { FlujoCajaChart } from '@/components/organisms/FlujoCajaChart'
import { ExposicionCambiariaCard } from '@/components/organisms/ExposicionCambiariaCard'
import { TopClientesPareto } from '@/components/organisms/TopClientesPareto'
import { ClientesInactivosList } from '@/components/organisms/ClientesInactivosList'
import { ContratosSinFirmarList } from '@/components/organisms/ContratosSinFirmarList'

/**
 * Secciones del dashboard (15) como Server Components asíncronos: cada una
 * pide sus datos a `dashboardService` y compone organisms. `page.tsx` las
 * envuelve en su propio `Suspense`, así una consulta lenta no bloquea la fila
 * de KPIs. Las que comparten datos (analítica del período, cartera) los
 * piden por `cache` de React: una sola consulta por request.
 */

const operativoCache = cache(() => getOperativo())

const analiticaCache = cache((rol: Rol | null, desde: string, hasta: string, producto: string | null) =>
  getAnalitica(rol, { desde, hasta }, producto)
)

const carteraCache = cache((rol: Rol | null, dias: DiasFlujo) => getCartera(rol, dias))

export interface ParamsAnalitica {
  rol: Rol | null
  desde: string
  hasta: string
  producto: string | null
}

/** Fila de KPIs del día (A). Para el operador, sin importes. */
export async function SeccionKpis({ rol }: { rol: Rol | null }) {
  const [tasas, operativo, kpis] = await Promise.all([
    getTasasDelDia(),
    operativoCache(),
    getKpisDia(rol),
  ])
  return <KpisDiaRow tasas={tasas} operativo={operativo.operativo} kpis={kpis} />
}

/** Pedidos próximos y antigüedad de lotes (D1, D3; todos los roles). */
export async function SeccionOperativa() {
  const { operativo, antiguedad } = await operativoCache()
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <PedidosProximosList operativo={operativo} />
      <AntiguedadLotesChart antiguedad={antiguedad} />
    </div>
  )
}

/** Ventas y margen (B1–B5, B9–B11; admin). */
export async function SeccionVentas({ rol, desde, hasta, producto }: ParamsAnalitica) {
  const a = await analiticaCache(rol, desde, hasta, producto)
  if (!a) return null
  const productos = a.productos.ok
    ? a.productos.data.map((p) => ({ id: p.producto_id, nombre: p.producto_nombre }))
    : []
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <VentasMensualesChart ventas={a.ventas_mensuales} />
        </div>
        <ResultadoCambiarioCard resultado={a.resultado_cambiario} />
      </div>
      <ProductosSalidaTable productos={a.productos} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <SpreadPrecioCostoChart
          spread={a.spread}
          granularidad={a.granularidad_spread}
          productoId={a.producto_spread}
          productos={productos}
        />
        <MezclaVentasPanel mezcla={a.mezcla} />
      </div>
    </div>
  )
}

/** Procesos e inventario (B6–B8 del período + valor del inventario a hoy; admin). */
export async function SeccionProcesos({
  rol,
  desde,
  hasta,
  producto,
  dias,
}: ParamsAnalitica & { dias: DiasFlujo }) {
  const [a, c] = await Promise.all([analiticaCache(rol, desde, hasta, producto), carteraCache(rol, dias)])
  if (!a || !c) return null
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <MermaProcesosPanel merma={a.merma} />
        <PerdidasMotivoChart perdidas={a.perdidas} />
      </div>
      <RendimientoProveedorTable rendimiento={a.rendimiento} />
      <ValorInventarioPanel valor={c.valor_inventario} />
    </div>
  )
}

/** Cartera, flujo y riesgo (C1–C4; admin, foto a hoy). */
export async function SeccionCartera({ rol, dias }: { rol: Rol | null; dias: DiasFlujo }) {
  const c = await carteraCache(rol, dias)
  if (!c) return null
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AgingCarteraChart aging={c.aging} />
        <TopDeudoresList deudores={c.deudores} />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <FlujoCajaChart flujo={c.flujo} dias={dias} />
        </div>
        <ExposicionCambiariaCard exposicion={c.exposicion} />
      </div>
    </div>
  )
}

/** Clientes (B12 del período; C5 y contratos a hoy; admin). */
export async function SeccionClientes({
  rol,
  desde,
  hasta,
  producto,
  dias,
}: ParamsAnalitica & { dias: DiasFlujo }) {
  const [a, c] = await Promise.all([analiticaCache(rol, desde, hasta, producto), carteraCache(rol, dias)])
  if (!a || !c) return null
  return (
    <div className="grid min-w-0 gap-4">
      <TopClientesPareto top={a.top_clientes} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ClientesInactivosList inactivos={c.inactivos} dias={DIAS_INACTIVIDAD} />
        <ContratosSinFirmarList contratos={c.contratos} />
      </div>
    </div>
  )
}
