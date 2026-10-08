import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BloqueDashboard,
  Dashboard,
  DashboardAnalitica,
  DashboardCartera,
  DashboardOperativoBloques,
  DiasFlujo,
  KpisDia,
  PuntoSpread,
  RangoFechas,
  TasasDelDia,
  ValorInventarioProducto,
  VentaMensual,
} from '@/types/domain'
import type { IDashboardRepository } from '@/lib/repositories/interfaces'
import { makeDashboardRepository } from '@/lib/repositories/dashboardRepository'
import { createClient } from '@/lib/supabase/server'
import { fechaHoy } from '@/lib/format'
import {
  granularidadSpread,
  mesesVentas,
  periodosDelRango,
} from '@/lib/dashboard/rangos'
import {
  flujoAcumulado,
  mezclaDesdeFilas,
  ordenarTramosAging,
  paretoAcumulado,
  rellenarSerie,
  topConResto,
} from '@/lib/dashboard/series'
import { getRol, type Rol } from './authService'
import { getConfigTasas, getTasaVigente, getTasasVigentesHoy } from './tasaService'

/**
 * DashboardService (SRP): compone el dashboard (15) a partir de las RPC
 * `dashboard_*`. Es el único que usa `IDashboardRepository`.
 *
 *   - **Aplica el rol**: para el operador no invoca ninguna RPC de importes
 *     (devuelve `undefined`); las RPC además fallan con `42501`.
 *   - Cada bloque es `{ ok, data } | { ok: false, error }`: un bloque con error
 *     no tumba los demás.
 *   - Bs = USD × tasa vigente de hoy de `config_negocio.fuente_tasa_default`
 *     (mismo criterio que `/inventario`).
 *   - Las funciones puras (`lib/dashboard/*`) rellenan series, arman el
 *     Pareto, el flujo acumulado y la mezcla.
 *
 * Cada sección tiene su función (la página las usa en `Suspense` separados);
 * `getDashboard` las compone todas.
 */

/** Primeros N de los rankings del dashboard. */
export const LIMITE_TOP = 10
/** Días sin compra para considerar inactivo a un cliente (C5). */
export const DIAS_INACTIVIDAD = 30

async function bloque<T>(nombre: string, fn: () => Promise<T>): Promise<BloqueDashboard<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    console.error(`[dashboard] ${nombre}:`, e)
    return { ok: false, error: `No se pudo cargar ${nombre}.` }
  }
}

async function repo(db?: SupabaseClient): Promise<IDashboardRepository> {
  return makeDashboardRepository(db ?? (await createClient()))
}

/** Rol de la sesión (deduplicado por request en `getUsuarioActual`). */
export async function getRolDashboard(): Promise<Rol | null> {
  return getRol()
}

/**
 * Tasa para convertir a Bs: vigente de hoy de la fuente por defecto. Una sola
 * lectura por request (la usan la fila de KPIs y el valor del inventario).
 */
const tasaBsHoy = cache(async (): Promise<number | null> => {
  const db = await createClient()
  const { fuente_tasa_default } = await getConfigTasas(db)
  const vigente = await getTasaVigente(fechaHoy(), fuente_tasa_default, 'USD', db)
  return vigente ? Number(vigente.tasa.valor_bs) : null
})

async function tasaBsSegura(): Promise<number | null> {
  try {
    return await tasaBsHoy()
  } catch (e) {
    console.error('[dashboard] tasa para Bs:', e)
    return null
  }
}

/** Tasas de hoy (A): BCV y paralela USD, EUR de referencia; cualquier rol. */
export async function getTasasDelDia(db?: SupabaseClient): Promise<BloqueDashboard<TasasDelDia>> {
  return bloque('la tasa del día', async () => {
    const t = await getTasasVigentesHoy(db)
    return {
      bcv: t.bcv.usd,
      paralela: t.paralela.usd,
      eur: t.bcv.eur,
      fuente_default: t.config.fuente_tasa_default,
    }
  })
}

/** Pedidos próximos, alertas de stock y antigüedad de lotes (cualquier rol, sin costos). */
export async function getOperativo(db?: SupabaseClient): Promise<DashboardOperativoBloques> {
  const r = await repo(db)
  const [operativo, antiguedad] = await Promise.all([
    bloque('los pedidos y alertas', () => r.operativo()),
    bloque('la antigüedad de los lotes', () => r.antiguedadLotes()),
  ])
  return { operativo, antiguedad }
}

/** KPIs del día con importes (admin). `undefined` para el operador. */
export async function getKpisDia(
  rol: Rol | null,
  db?: SupabaseClient
): Promise<BloqueDashboard<KpisDia> | undefined> {
  if (rol !== 'admin') return undefined
  const r = await repo(db)
  return bloque('los indicadores del día', async () => {
    const [k, tasa] = await Promise.all([r.kpisDia(), tasaBsSegura()])
    return {
      ...k,
      margen_pct: k.ventas_usd !== 0 ? k.margen_usd / k.ventas_usd : null,
      inventario_bs: tasa ? k.inventario_usd * tasa : null,
    }
  })
}

/** Sección analítica por período (admin). `undefined` para el operador. */
export async function getAnalitica(
  rol: Rol | null,
  rango: RangoFechas,
  productoSpread: string | null = null,
  db?: SupabaseClient
): Promise<DashboardAnalitica | undefined> {
  if (rol !== 'admin') return undefined
  const r = await repo(db)
  const gran = granularidadSpread(rango)

  const [
    ventas_mensuales,
    productos,
    resultado_cambiario,
    spread,
    merma,
    rendimiento,
    perdidas,
    mezcla,
    top_clientes,
  ] = await Promise.all([
    bloque('las ventas por mes', async () =>
      rellenarSerie(
        mesesVentas(rango.hasta),
        await r.ventasMensuales(rango),
        (f) => f.mes,
        (mes): VentaMensual => ({ mes, ventas_usd: 0, kg: 0, facturas: 0 })
      )
    ),
    bloque('los productos con salida', () => r.productosSalida(rango)),
    bloque('el resultado cambiario', () => r.resultadoCambiario(rango)),
    bloque('el spread precio/costo', async () =>
      rellenarSerie(
        periodosDelRango(rango, gran),
        await r.spreadPrecioCosto(rango, productoSpread),
        (f) => f.periodo,
        (periodo): PuntoSpread => ({
          periodo,
          granularidad: gran,
          kg: 0,
          precio_medio_usd_kg: null,
          costo_medio_usd_kg: null,
          spread_usd_kg: null,
        })
      )
    ),
    bloque('la merma por procesos', () => r.mermaProcesos(rango)),
    bloque('el rendimiento por proveedor', () => r.rendimientoProveedor(rango)),
    bloque('las pérdidas por motivo', () => r.perdidasMotivo(rango)),
    bloque('la mezcla de ventas', async () => mezclaDesdeFilas(await r.mezclaVentas(rango))),
    bloque('los mejores clientes', async () => {
      const filas = await r.topClientes(rango, LIMITE_TOP)
      return paretoAcumulado(filas, filas[0]?.total_periodo_usd ?? 0, filas[0]?.clientes_periodo ?? 0)
    }),
  ])

  return {
    rango,
    granularidad_spread: gran,
    producto_spread: productoSpread,
    ventas_mensuales,
    productos,
    resultado_cambiario,
    spread,
    merma,
    rendimiento,
    perdidas,
    mezcla,
    top_clientes,
  }
}

/** Cartera, flujo, riesgo, inventario valorizado y contratos (admin; foto a hoy). */
export async function getCartera(
  rol: Rol | null,
  diasFlujo: DiasFlujo,
  db?: SupabaseClient
): Promise<DashboardCartera | undefined> {
  if (rol !== 'admin') return undefined
  const r = await repo(db)

  const [aging, deudores, flujo, exposicion, inactivos, contratos, valor_inventario] =
    await Promise.all([
      bloque('la antigüedad de la cartera', async () => ordenarTramosAging(await r.agingCartera())),
      bloque('los principales deudores', () => r.topDeudores(LIMITE_TOP)),
      bloque('el flujo proyectado', async () =>
        flujoAcumulado(await r.flujoProyectado(diasFlujo), diasFlujo)
      ),
      bloque('la exposición cambiaria', () => r.exposicionCambiaria()),
      bloque('los clientes inactivos', () => r.clientesInactivos(DIAS_INACTIVIDAD)),
      bloque('los contratos sin firmar', () => r.contratosSinFirmar()),
      bloque('el valor del inventario', async () => {
        const [filas, tasa] = await Promise.all([r.valorInventario(), tasaBsSegura()])
        return topConResto(
          filas.map(
            (f): ValorInventarioProducto => ({ ...f, valor_bs: tasa ? f.valor_usd * tasa : null })
          ),
          LIMITE_TOP
        )
      }),
    ])

  return { aging, deudores, flujo, exposicion, inactivos, contratos, valor_inventario }
}

/**
 * Dashboard completo. Con rol operador, `kpisDia`, `analitica` y `cartera`
 * son `undefined` y no se llama a ninguna de esas RPC.
 */
export async function getDashboard(params: {
  rango: RangoFechas
  diasFlujo: DiasFlujo
  productoSpread?: string | null
}): Promise<Dashboard> {
  const [rol, db] = await Promise.all([getRolDashboard(), createClient()])
  const [tasas, operativo, kpisDia, analitica, cartera] = await Promise.all([
    getTasasDelDia(db),
    getOperativo(db),
    getKpisDia(rol, db),
    getAnalitica(rol, params.rango, params.productoSpread ?? null, db),
    getCartera(rol, params.diasFlujo, db),
  ])
  return { rol, tasas, operativo, kpisDia, analitica, cartera }
}
