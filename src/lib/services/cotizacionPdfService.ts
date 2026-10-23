import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { DatosCotizacionPdf } from '@/types/domain'
import { CotizacionPdf } from '@/lib/cotizaciones/pdf/CotizacionPdf'
import { datosPdfDesdeDetalle } from '@/lib/cotizaciones/pdfDatos'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import { registrarFuentesMarca } from '@/lib/pdf/fuentes'
import { fechaHoy } from '@/lib/format'
import { getConfigNegocio } from './configService'
import { getCotizacion } from './cotizacionService'

/**
 * PDF de una cotización (21-cotizaciones, P6). Strategy: los servicios y las
 * rutas dependen de `ICotizacionPdfRenderer`, no de la librería; cambiar de
 * motor (p. ej. `pdf-lib`) solo cambiaría `reactPdfCotizacionRenderer`. Se
 * renderiza al vuelo en route handlers de Node; no se guarda en storage.
 */
export interface ICotizacionPdfRenderer {
  render(datos: DatosCotizacionPdf): Promise<Uint8Array>
}

export const reactPdfCotizacionRenderer: ICotizacionPdfRenderer = {
  async render(datos) {
    const fuentes = registrarFuentesMarca()
    // `CotizacionPdf` devuelve un `<Document>`: el cast solo informa el tipo a react-pdf.
    const documento = createElement(CotizacionPdf, { datos, fuentes }) as unknown as ReactElement<DocumentProps>
    const buffer = await renderToBuffer(documento)
    return new Uint8Array(buffer)
  },
}

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
