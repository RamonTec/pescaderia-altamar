import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/services/authService'
import { urlFirmada } from '@/lib/services/contratoService'

/**
 * Entrega del PDF de un contrato (06-contratos): verifica admin, crea una URL
 * firmada al vuelo (TTL 60 s) y redirige (302). La URL nunca se guarda.
 * `?descargar=1` fuerza la descarga como `contrato-0007.pdf`. Sin caché:
 * lee la sesión en cada request. Un operador recibe 404 (no revela existencia).
 */

const noEncontrado = () => new Response('No encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return noEncontrado()
  if (!(await requireAdmin())) return noEncontrado()

  let url: string | null
  try {
    url = await urlFirmada(id, { descargar: request.nextUrl.searchParams.get('descargar') === '1' })
  } catch (e) {
    console.error('[contratos/pdf] error:', e)
    return noEncontrado()
  }
  if (!url) return noEncontrado()

  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store' },
  })
}
