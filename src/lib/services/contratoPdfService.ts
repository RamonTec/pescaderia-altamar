import { renderToBuffer } from '@react-pdf/renderer'
import type { DatosContratoPdf } from '@/types/domain'
import { ContratoTemplateFactory } from '@/lib/contratos/plantillas/factory'

/**
 * Render del PDF de un contrato (06-contratos). Strategy: el servicio de
 * contratos depende de `IContratoPdfRenderer`, no de la librería; cambiar a
 * `pdf-lib` solo cambiaría esta implementación.
 */
export interface IContratoPdfRenderer {
  render(datos: DatosContratoPdf): Promise<Uint8Array>
}

export const reactPdfContratoRenderer: IContratoPdfRenderer = {
  async render(datos) {
    const documento = ContratoTemplateFactory.crear(datos.tipo)(datos)
    const buffer = await renderToBuffer(documento)
    return new Uint8Array(buffer)
  },
}
