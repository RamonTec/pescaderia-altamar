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

/** Acuerdo de venta a crédito (factura): el negocio es EL ACREEDOR. */
export function ContratoVentaPdf({ datos }: { datos: DatosContratoPdf }) {
  return (
    <Document
      title={`${TITULO_CONTRATO.venta_credito} ${numeroContrato(datos.numero)}`}
      author={datos.negocio.razon_social}
      language="es"
    >
      <Page size="LETTER" style={estilos.pagina}>
        <Pie datos={datos} />
        <Encabezado datos={datos} />
        <Partes datos={datos} />
        <DocumentoOrigen datos={datos} />
        <TablaItems datos={datos} etiquetaPrecio="Precio USD/kg" />
        <Totales datos={datos} />
        <TasaPactada datos={datos} />
        <Clausula datos={datos} />
        <Notas datos={datos} />
        <Firmas datos={datos} />
      </Page>
    </Document>
  )
}
