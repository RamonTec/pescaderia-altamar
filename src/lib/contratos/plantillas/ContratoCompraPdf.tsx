import { Document, Page } from '@react-pdf/renderer'
import type { DatosContratoPdf } from '@/types/domain'
import { TITULO_CONTRATO, numeroContrato } from '@/lib/contratos/textos'
import {
  Clausula,
  DocumentoOrigen,
  Encabezado,
  Firmas,
  Notas,
  Partes,
  Pie,
  TablaItems,
  TasaPactada,
  Totales,
  estilos,
} from './bloques'

/** Acuerdo de compra a crédito: el negocio es EL DEUDOR. Sin IVA ni notas de crédito. */
export function ContratoCompraPdf({ datos }: { datos: DatosContratoPdf }) {
  return (
    <Document
      title={`${TITULO_CONTRATO.compra_credito} ${numeroContrato(datos.numero)}`}
      author={datos.negocio.razon_social}
      language="es"
    >
      <Page size="LETTER" style={estilos.pagina}>
        <Pie datos={datos} />
        <Encabezado datos={datos} />
        <Partes datos={datos} />
        <DocumentoOrigen datos={datos} />
        <TablaItems datos={datos} etiquetaPrecio="Costo USD/kg" />
        <Totales datos={datos} />
        <TasaPactada datos={datos} />
        <Clausula datos={datos} />
        <Notas datos={datos} />
        <Firmas datos={datos} />
      </Page>
    </Document>
  )
}
