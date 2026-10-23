import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { CotizacionNoDisponible } from '@/components/organisms/CotizacionNoDisponible'
import { CotizacionPublicaVista } from '@/components/organisms/CotizacionPublicaVista'
import { tokenValido } from '@/lib/cotizaciones/enlace'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import { NOMBRE_MARCA } from '@/theme/marca'
import { leerCotizacionPublica } from './datos'

/**
 * Enlace público de una cotización (21-cotizaciones, P7), sin sesión.
 * Dinámica: cada visita lee `cotizacion_publica` con el cliente anónimo.
 * - `disponible` → documento, «Descargar PDF» y WhatsApp al negocio.
 * - `vencida` / `no_disponible` → página de respaldo (HTTP 200, `noindex`).
 * Un token con formato inválido va a `not-found.tsx` (mismo respaldo genérico).
 */

const ROBOTS: Metadata['robots'] = { index: false, follow: false }

export async function generateMetadata({ params }: PageProps<'/c/[token]'>): Promise<Metadata> {
  const { token } = await params
  const r = await leerCotizacionPublica(token)
  if (r.resultado === 'disponible') {
    const nombre = r.negocio.nombre_comercial || NOMBRE_MARCA
    return {
      title: `Cotización ${formatNumeroCotizacion(r.cotizacion.numero)} · ${nombre}`,
      // Sin montos: la vista previa de WhatsApp no debe mostrar importes.
      description: `Cotización de ${nombre}. Ábrela para ver el detalle y descargar el PDF.`,
      robots: ROBOTS,
      referrer: 'no-referrer',
    }
  }
  return { title: r.negocio.nombre_comercial || NOMBRE_MARCA, robots: ROBOTS, referrer: 'no-referrer' }
}

export default async function CotizacionPublicaPage({ params }: PageProps<'/c/[token]'>) {
  await connection()
  const { token } = await params
  if (!tokenValido(token)) notFound()

  const r = await leerCotizacionPublica(token)
  if (r.resultado === 'disponible') {
    return <CotizacionPublicaVista cotizacion={r.cotizacion} negocio={r.negocio} token={token} />
  }
  if (r.resultado === 'vencida') {
    return <CotizacionNoDisponible variante="vencida" numero={r.numero} negocio={r.negocio} />
  }
  return <CotizacionNoDisponible variante="generica" negocio={r.negocio} />
}
