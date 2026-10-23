import { CotizacionesScreen } from './cotizaciones-screen'
import { filtrosCotizacionesSchema } from '@/lib/cotizacionValidation'
import { getCatalogoCotizacion, listarCotizaciones } from '@/lib/services/cotizacionService'
import { fechaHoy } from '@/lib/format'

/**
 * Cotizaciones (21-cotizaciones), admin y operador (P4). Filtros y página en
 * la URL (`?estado=`, `?q=`, `?desde`/`?hasta`, `?pagina=`, `?limite=`); el
 * servidor trae la página de `cotizaciones_listado_view`.
 */
export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const plano = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
  const filtros = filtrosCotizacionesSchema.parse(plano)
  const [pagina, catalogo] = await Promise.all([listarCotizaciones(filtros), getCatalogoCotizacion()])

  return (
    <CotizacionesScreen
      cotizaciones={pagina.rows}
      total={pagina.total}
      filtros={filtros}
      catalogo={catalogo}
      hoy={fechaHoy()}
    />
  )
}
