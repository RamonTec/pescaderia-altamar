import { datosPdfDesdeDetalle } from '@/lib/cotizaciones/pdfDatos'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import {
  reactPdfCotizacionRenderer,
  type ICotizacionPdfRenderer,
} from '@/lib/cotizaciones/pdf/renderer'
import { fechaHoy } from '@/lib/format'
import { getConfigNegocio } from './configService'
import { getCotizacion } from './cotizacionService'

/**
 * PDF de una cotización (21-cotizaciones, P6): se renderiza al vuelo en
 * route handlers de Node (no se guarda en storage) detrás de
 * `ICotizacionPdfRenderer` (Strategy; impl react-pdf en
 * `lib/cotizaciones/pdf/renderer.ts`).
 */
export { reactPdfCotizacionRenderer, type ICotizacionPdfRenderer }

/** `cotizacion-COT-000123.pdf`. */
export function nombreArchivoCotizacion(numero: number): string {
  return `cotizacion-${formatNumeroCotizacion(numero)}.pdf`
}

/**
 * PDF interno (sesión exigida por `getCotizacion`). `null` si no existe o
 * está anulada (una anulada no tiene PDF).
 */
export async function pdfCotizacionInterna(
  id: string,
  renderer: ICotizacionPdfRenderer = reactPdfCotizacionRenderer
): Promise<{ bytes: Uint8Array; nombre: string } | null> {
  const detalle = await getCotizacion(id)
  if (!detalle || detalle.estado === 'anulada') return null
  const config = await getConfigNegocio()
  const bytes = await renderer.render(datosPdfDesdeDetalle(detalle, config, fechaHoy()))
  return { bytes, nombre: nombreArchivoCotizacion(detalle.numero) }
}
