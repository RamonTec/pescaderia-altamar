import { notFound } from 'next/navigation'
import { z } from 'zod'
import { CotizacionFicha } from './cotizacion-ficha'
import { baseUrlPublica, getCatalogoCotizacion, getCotizacion } from '@/lib/services/cotizacionService'
import { fechaHoy } from '@/lib/format'

/**
 * Ficha de una cotización (21-cotizaciones): todo se carga aquí y llega por
 * props. Un id mal formado o inexistente va a `not-found.tsx`.
 */
export default async function CotizacionFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const cotizacion = await getCotizacion(id)
  if (!cotizacion) notFound()
  const [catalogo, base] = await Promise.all([getCatalogoCotizacion(), baseUrlPublica()])

  return <CotizacionFicha cotizacion={cotizacion} catalogo={catalogo} hoy={fechaHoy()} baseEnlace={base} />
}
