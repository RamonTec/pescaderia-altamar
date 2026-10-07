import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { DatosContratoPdf, TipoContrato } from '@/types/domain'
import { ContratoCompraPdf } from './ContratoCompraPdf'
import { ContratoVentaPdf } from './ContratoVentaPdf'

/** Construye el documento PDF de un contrato a partir de sus datos. */
export type PlantillaContrato = (datos: DatosContratoPdf) => ReactElement<DocumentProps>

type ComponentePlantilla = (props: { datos: DatosContratoPdf }) => ReactElement<DocumentProps>

/** Un `tipo` sin plantilla no compila (Record exhaustivo). */
const PLANTILLAS: Record<TipoContrato, ComponentePlantilla> = {
  venta_credito: ContratoVentaPdf,
  compra_credito: ContratoCompraPdf,
}

/** Factory (06-contratos): elige la plantilla por `tipo`. */
export const ContratoTemplateFactory = {
  crear(tipo: TipoContrato): PlantillaContrato {
    const Plantilla = PLANTILLAS[tipo]
    // `renderToBuffer` espera el elemento `<Document>`: se invoca la plantilla
    // como función para obtenerlo directamente.
    return (datos) => Plantilla({ datos })
  },
}

