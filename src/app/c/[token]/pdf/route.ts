import type { NextRequest } from 'next/server'
import { pdfCotizacionPublica } from '@/lib/services/cotizacionPublicaService'

/**
 * PDF público de una cotización (21-cotizaciones, P7). Solo con
 * `resultado = disponible` se genera; vencida, revocada, anulada, borrador o
 * inexistente → 302 a `/c/[token]` (que muestra el respaldo) sin generar
 * nada. Sin caché, `noindex` y sin `Referer` hacia terceros.
 */

const CABECERAS_BASE = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

export async function GET(request: NextRequest, ctx: RouteContext<'/c/[token]/pdf'>) {
  const { token } = await ctx.params
  const pagina = new URL(`/c/${encodeURIComponent(token)}`, request.nextUrl.origin)

  let pdf: Awaited<ReturnType<typeof pdfCotizacionPublica>> = null
  try {
    pdf = await pdfCotizacionPublica(token)
  } catch (e) {
    console.error('[c/pdf] error:', e)
  }
  if (!pdf) return new Response(null, { status: 302, headers: { ...CABECERAS_BASE, Location: pagina.toString() } })

  const disposicion = request.nextUrl.searchParams.get('descargar') === '1' ? 'attachment' : 'inline'
  return new Response(Buffer.from(pdf.bytes), {
    status: 200,
    headers: {
      ...CABECERAS_BASE,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposicion}; filename="${pdf.nombre}"`,
    },
  })
}
