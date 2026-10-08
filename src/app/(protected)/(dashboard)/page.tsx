import { Suspense } from 'react'
import { DashboardTemplate } from '@/components/templates/DashboardTemplate'
import { PageHeader } from '@/components/molecules/PageHeader'
import { RangoFechasSelector } from '@/components/molecules/RangoFechasSelector'
import { KpisDiaRowSkeleton } from '@/components/organisms/KpisDiaRow'
import { SeccionSkeleton } from '@/components/organisms/DashboardSkeletons'
import { getRolDashboard } from '@/lib/services/dashboardService'
import {
  diasFlujoDesdeParam,
  productoSpreadDesdeParam,
  rangoDesdeParams,
} from '@/lib/dashboardValidation'
import { fechaHoy, formatFecha } from '@/lib/format'
import {
  SeccionCartera,
  SeccionClientes,
  SeccionKpis,
  SeccionOperativa,
  SeccionProcesos,
  SeccionVentas,
} from './dashboard-secciones'

/**
 * Dashboard (pantalla 7 de /SPEC.md §7; módulo 15). Server Component:
 * valida `?desde`/`?hasta` (inválido → mes en curso), `?flujo` y `?producto`
 * y compone `DashboardTemplate` con cada sección en su `Suspense`. El
 * operador solo recibe la fila del día y el bloque operativo (sin importes);
 * las secciones de admin ni se piden.
 *
 * Las claves de los `Suspense` del análisis dependen del rango: al cambiarlo,
 * solo esas secciones vuelven a su skeleton; la fila de KPIs se queda.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const hoy = fechaHoy()
  const { rango } = rangoDesdeParams(params, hoy)
  const dias = diasFlujoDesdeParam(params.flujo)
  const producto = productoSpreadDesdeParam(params.producto)
  const rol = await getRolDashboard()
  const esAdmin = rol === 'admin'

  const analitica = { rol, desde: rango.desde, hasta: rango.hasta, producto }
  const claveRango = `${rango.desde}|${rango.hasta}|${producto ?? ''}`

  return (
    <DashboardTemplate
      header={<PageHeader title="Dashboard" subtitle={`Hoy, ${formatFecha(hoy)}`} />}
      kpis={
        <Suspense fallback={<KpisDiaRowSkeleton tarjetas={esAdmin ? 8 : 3} />}>
          <SeccionKpis rol={rol} />
        </Suspense>
      }
      operativo={
        <Suspense fallback={<SeccionSkeleton titulos={['Pedidos de hoy y mañana', 'Antigüedad de lotes abiertos']} />}>
          <SeccionOperativa />
        </Suspense>
      }
      admin={
        esAdmin
          ? {
              selector: <RangoFechasSelector rango={rango} hoy={hoy} />,
              ventas: (
                <Suspense
                  key={`ventas-${claveRango}`}
                  fallback={
                    <SeccionSkeleton
                      titulos={['Ventas por mes', 'Resultado cambiario (Bs)', 'Productos con salida y margen']}
                      columnas="lg:grid-cols-3"
                    />
                  }
                >
                  <SeccionVentas {...analitica} />
                </Suspense>
              ),
              procesos: (
                <Suspense
                  key={`procesos-${claveRango}`}
                  fallback={<SeccionSkeleton titulos={['Merma por procesos', 'Pérdidas por motivo']} />}
                >
                  <SeccionProcesos {...analitica} dias={dias} />
                </Suspense>
              ),
              cartera: (
                <Suspense
                  key={`cartera-${dias}`}
                  fallback={<SeccionSkeleton titulos={['Antigüedad de la cartera', 'Principales deudores']} />}
                >
                  <SeccionCartera rol={rol} dias={dias} />
                </Suspense>
              ),
              clientes: (
                <Suspense
                  key={`clientes-${claveRango}`}
                  fallback={<SeccionSkeleton titulos={['Mejores clientes (Pareto)', 'Clientes inactivos']} />}
                >
                  <SeccionClientes {...analitica} dias={dias} />
                </Suspense>
              ),
            }
          : undefined
      }
    />
  )
}
