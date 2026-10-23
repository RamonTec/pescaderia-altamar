import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { DatosCotizacionPdf } from '@/types/domain'
import { registrarFuentesMarca } from '@/lib/pdf/fuentes'
import { CotizacionPdf } from './CotizacionPdf'

/**
 * Render del PDF de una cotización (21-cotizaciones, P6), sin acceso a datos:
 * lo usan `cotizacionPdfService` y `scripts/probar-cotizaciones.ts --pdf`.
 * Strategy: los servicios dependen de `ICotizacionPdfRenderer`; cambiar de
 * motor (p. ej. `pdf-lib`) solo cambiaría `reactPdfCotizacionRenderer`.
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
