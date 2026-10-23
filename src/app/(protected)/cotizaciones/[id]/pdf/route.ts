import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { pdfCotizacionInterna } from '@/lib/services/cotizacionPdfService'
import { CotizacionError } from '@/lib/services/cotizacionService'

/**
 * PDF interno de una cotización (21-cotizaciones, Fase B), renderizado al
 * vuelo (runtime Node). Sesión exigida por el servicio; 404 si no existe, si
 * está anulada o sin sesión. `inline` por defecto, `attachment` con
 * `?descargar=1`; nombre `cotizacion-COT-000123.pdf`. Sin caché.
 */

const noEncontrado = () =>
  new Response('No encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: NextRequest, ctx: RouteContext<'/cotizaciones/[id]/pdf'>) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return noEncontrado()

  let pdf: Awaited<ReturnType<typeof pdfCotizacionInterna>>
  try {
    pdf = await pdfCotizacionInterna(id)
  } catch (e) {
    if (e instanceof CotizacionError) return noEncontrado()
    console.error('[cotizaciones/pdf] error:', e)
    return new Response('No se pudo generar el PDF', { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!pdf) return noEncontrado()

  const disposicion = request.nextUrl.searchParams.get('descargar') === '1' ? 'attachment' : 'inline'
  return new Response(Buffer.from(pdf.bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposicion}; filename="${pdf.nombre}"`,
      'Cache-Control': 'no-store',
    },
  })
}
