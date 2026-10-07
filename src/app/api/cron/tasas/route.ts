import { createHash, timingSafeEqual } from 'node:crypto'
import { actualizarTasas } from '@/lib/services/tasaService'

/**
 * Cron de Vercel (08-tasas): `GET /api/cron/tasas` actualiza las tasas (BCV
 * scraping → dolarapi; paralela por dolarapi) y devuelve el resumen por
 * fuente y moneda. Protegido con `CRON_SECRET` (header
 * `Authorization: Bearer <secreto>` o `?secret=`).
 *
 * Horarios en `vercel.json`: 12:00 UTC (08:00 VET, primera publicación
 * del BCV) y 17:00 UTC (13:00 VET, actualización de la tarde). Nota: en el
 * plan Hobby de Vercel los cron corren como máximo una vez al día — solo
 * corre el primero y se apoya en la obtención bajo demanda
 * (`asegurarTasaDeHoy`).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Comparación en tiempo constante (el secreto es un valor sensible). */
function secretoCoincide(recibido: string, esperado: string): boolean {
  const hash = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(hash(recibido), hash(esperado))
}

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  if (!esperado) {
    return Response.json({ error: 'CRON_SECRET no está configurado' }, { status: 500 })
  }
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const porQuery = new URL(request.url).searchParams.get('secret')
  const autorizado =
    (bearer != null && secretoCoincide(bearer, esperado)) ||
    (porQuery != null && secretoCoincide(porQuery, esperado))
  if (!autorizado) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const resumen = await actualizarTasas({ forzar: true })
  return Response.json(resumen)
}
