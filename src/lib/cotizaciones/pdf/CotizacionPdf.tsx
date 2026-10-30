import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { MARCA_CLARO } from '@/theme/marca'
import { EncabezadoMarca, PiePagina } from '@/lib/pdf/marca'
import type { FuentesPdf } from '@/lib/pdf/fuentes'
import { etiquetaIva } from '@/lib/facturas/iva'
import { formatFecha, formatFechaHora, formatKg, formatUsd } from '@/lib/format'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import type { DatosCotizacionPdf } from '@/types/domain'

/**
 * Plantilla del PDF de una cotización (21-cotizaciones, Fase B). Pura:
 * datos → `<Document>` de react-pdf. Carta, una o más páginas: encabezado de
 * marca, número y fechas (sello si no está vigente), cliente, tabla de líneas
 * (las filas no se cortan entre páginas y la cabecera se repite), totales
 * solo en USD (P1), notas para el cliente, términos, instrucciones de pago y
 * pie con número de página. Nunca recibe notas internas.
 */

const TEXTO = '#0B1B33'
const SECUNDARIO = '#4A5260'
const BORDE = '#E4E1D8'
/** `palette.error.main` (claro): sello de anulada. */
const ERROR = '#B3261E'

function estilos(f: FuentesPdf) {
  return StyleSheet.create({
    pagina: {
      fontFamily: f.cuerpo,
      fontSize: 9,
      color: TEXTO,
      paddingTop: 36,
      paddingBottom: 64,
      paddingHorizontal: 48,
    },
    bloque: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 14 },
    etiqueta: { fontSize: 7.5, color: SECUNDARIO, textTransform: 'uppercase', letterSpacing: 0.6 },
    titulo: { ...f.titulo, fontSize: 16, color: MARCA_CLARO.midnight, marginTop: 2 },
    sello: {
      ...f.cuerpoNegrita,
      fontSize: 9,
      color: ERROR,
      borderWidth: 1,
      borderColor: ERROR,
      paddingHorizontal: 6,
      paddingVertical: 2,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    secundario: { color: SECUNDARIO },
    negrita: f.cuerpoNegrita,
    tabla: { borderTopWidth: 1, borderTopColor: MARCA_CLARO.midnight },
    filaCabecera: {
      flexDirection: 'row',
      backgroundColor: MARCA_CLARO.midnight,
      color: MARCA_CLARO.onMidnight,
      paddingVertical: 4,
      paddingHorizontal: 6,
      ...f.cuerpoNegrita,
      fontSize: 8.5,
    },
    fila: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: BORDE,
      paddingVertical: 2.5,
      paddingHorizontal: 6,
    },
    colProducto: { flex: 4.2, paddingRight: 6 },
    colNum: { flex: 1.4, textAlign: 'right' },
    nota: { fontSize: 7.5, color: SECUNDARIO },
    totales: { marginLeft: 'auto', width: 230, marginTop: 8 },
    filaTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
    filaGranTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: MARCA_CLARO.midnight,
      marginTop: 3,
      paddingTop: 4,
      ...f.titulo,
      fontSize: 12,
      color: MARCA_CLARO.midnight,
    },
    seccion: { marginTop: 14 },
    seccionTitulo: { ...f.cuerpoNegrita, fontSize: 9, color: MARCA_CLARO.midnight, marginBottom: 3 },
    parrafo: { lineHeight: 1.35 },
  })
}

export function CotizacionPdf({ datos, fuentes }: { datos: DatosCotizacionPdf; fuentes: FuentesPdf }) {
  const e = estilos(fuentes)
  const d = datos.documento
  const numero = formatNumeroCotizacion(d.numero)
  return (
    <Document title={`Cotización ${numero}`} author={datos.negocio.nombre_comercial ?? undefined} language="es">
      <Page size="LETTER" style={e.pagina}>
        <EncabezadoMarca negocio={datos.negocio} fuentes={fuentes} />

        <View style={e.bloque}>
          <View>
            <Text style={e.etiqueta}>Cotización</Text>
            <Text style={e.titulo}>N.º {numero}</Text>
            <Text style={e.secundario}>
              Fecha {formatFecha(d.fecha)} · Válida hasta {formatFecha(d.fecha_vencimiento)}
            </Text>
            {datos.sello ? <Text style={e.sello}>{datos.sello}</Text> : null}
          </View>
          <View style={{ maxWidth: 240 }}>
            <Text style={e.etiqueta}>Cliente</Text>
            <Text style={[e.negrita, { fontSize: 11, marginTop: 2 }]}>{d.cliente.nombre}</Text>
            {d.cliente.rif_ci ? (
              <Text style={e.secundario}>RIF/CI {d.cliente.rif_ci}</Text>
            ) : d.cliente.telefono ? (
              <Text style={e.secundario}>Tel. {d.cliente.telefono}</Text>
            ) : null}
          </View>
        </View>

        <View style={e.tabla}>
          <View style={e.filaCabecera} fixed>
            <Text style={e.colProducto}>Producto</Text>
            <Text style={e.colNum}>Kg</Text>
            <Text style={e.colNum}>Precio USD/kg</Text>
            <Text style={e.colNum}>Subtotal USD</Text>
          </View>
          {d.items.map((i, idx) => (
            <View key={idx} style={e.fila} wrap={false}>
              <View style={e.colProducto}>
                <Text>{i.producto_nombre}</Text>
                {i.nota ? <Text style={e.nota}>{i.nota}</Text> : null}
              </View>
              <Text style={e.colNum}>{formatKg(i.peso_kg)}</Text>
              <Text style={e.colNum}>{formatUsd(i.precio_usd_kg)}</Text>
              <Text style={e.colNum}>{formatUsd(i.subtotal_usd)}</Text>
            </View>
          ))}
        </View>

        <View style={e.totales} wrap={false}>
          <View style={e.filaTotal}>
            <Text style={e.secundario}>Subtotal</Text>
            <Text>{formatUsd(d.subtotal_usd)}</Text>
          </View>
          {d.descuento_usd > 0 ? (
            <View style={e.filaTotal}>
              <Text style={e.secundario}>Descuento</Text>
              <Text>−{formatUsd(d.descuento_usd)}</Text>
            </View>
          ) : null}
          <View style={e.filaTotal}>
            <Text style={e.secundario}>{etiquetaIva(d.iva_pct)}</Text>
            <Text>{d.iva_pct > 0 ? formatUsd(d.iva_usd) : '—'}</Text>
          </View>
          <View style={e.filaGranTotal}>
            <Text>Total USD</Text>
            <Text>{formatUsd(d.total_usd)}</Text>
          </View>
        </View>

        {d.notas_cliente ? (
          <View style={e.seccion} wrap={false}>
            <Text style={e.seccionTitulo}>Notas</Text>
            <Text style={e.parrafo}>{d.notas_cliente}</Text>
          </View>
        ) : null}
        {d.terminos ? (
          <View style={e.seccion}>
            <Text style={e.seccionTitulo}>Términos y condiciones</Text>
            <Text style={[e.parrafo, e.secundario]}>{d.terminos}</Text>
          </View>
        ) : null}
        {datos.instrucciones_pago ? (
          <View style={e.seccion} wrap={false}>
            <Text style={e.seccionTitulo}>Instrucciones de pago</Text>
            <Text style={e.parrafo}>{datos.instrucciones_pago}</Text>
          </View>
        ) : null}
        <Text style={[e.secundario, { marginTop: 14, fontSize: 7.5 }]}>
          Actualizada el {formatFechaHora(datos.actualizada_at)}
        </Text>

        <PiePagina
          texto="Documento no fiscal. Precios sujetos a disponibilidad de producto."
          fuentes={fuentes}
        />
      </Page>
    </Document>
  )
}
