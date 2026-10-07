import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { DatosContratoPdf } from '@/types/domain'
import { formatBs, formatFecha, formatKg, formatTasa, formatUsd } from '@/lib/format'
import { textoClausulaGananciaCambiaria } from '@/lib/contratos/clausulas'
import {
  ROLES_CONTRATO,
  TITULO_CONTRATO,
  describirTasa,
  numeroContrato,
  referenciaDocumento,
  textoDias,
  textoTipoPersona,
} from '@/lib/contratos/textos'

/**
 * Bloques compartidos de las plantillas de contrato (06-contratos). Puros:
 * datos → elementos de `@react-pdf/renderer`. No consultan datos ni calculan
 * tasas; solo multiplican USD × `tasa_snapshot` para el equivalente en Bs.
 * Helvetica integrada (sin archivos de fuente), tamaño carta.
 */

const GRIS = '#555555'
const BORDE = '#bbbbbb'
const FONDO = '#f2f2f2'

export const estilos = StyleSheet.create({
  pagina: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    // Sin `lineHeight` aquí: heredado por el pie absoluto, react-pdf no lo dibuja.
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 48,
    color: '#111111',
  },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    paddingBottom: 8,
    marginBottom: 12,
  },
  negocioNombre: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginBottom: 3 },
  gris: { color: GRIS },
  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 13, textAlign: 'right', marginBottom: 3 },
  derecha: { textAlign: 'right' },
  seccion: { marginBottom: 10 },
  seccionTitulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  negrita: { fontFamily: 'Helvetica-Bold' },
  partes: { flexDirection: 'row', gap: 12 },
  parte: { flex: 1, borderWidth: 1, borderColor: BORDE, padding: 6 },
  tabla: { borderWidth: 1, borderColor: BORDE },
  filaTabla: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDE,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  cabeceraTabla: { backgroundColor: FONDO, fontFamily: 'Helvetica-Bold' },
  colProducto: { flex: 4 },
  colNum: { flex: 1.6, textAlign: 'right' },
  totales: { marginLeft: 'auto', width: 260, marginTop: 6 },
  filaTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
  filaSaldo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#111111',
    marginTop: 3,
    paddingTop: 3,
    fontFamily: 'Helvetica-Bold',
  },
  parrafo: { textAlign: 'justify' },
  firmas: { flexDirection: 'row', gap: 32, marginTop: 40 },
  firma: { flex: 1, borderTopWidth: 1, borderTopColor: '#111111', paddingTop: 4 },
  pie: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: GRIS,
  },
})

interface BloqueProps {
  datos: DatosContratoPdf
}

const bs = (usd: number, tasa: number) => formatBs(usd * tasa)

export function Encabezado({ datos }: BloqueProps) {
  const { negocio } = datos
  return (
    <View style={estilos.encabezado}>
      <View>
        <Text style={estilos.negocioNombre}>{negocio.nombre_comercial ?? negocio.razon_social}</Text>
        <Text>{negocio.razon_social}</Text>
        <Text style={estilos.gris}>RIF {negocio.rif}</Text>
        <Text style={estilos.gris}>{negocio.direccion}</Text>
        <Text style={estilos.gris}>Tel. {negocio.telefono}</Text>
      </View>
      <View>
        <Text style={estilos.titulo}>{TITULO_CONTRATO[datos.tipo]}</Text>
        <Text style={[estilos.derecha, estilos.negrita]}>Contrato {numeroContrato(datos.numero)}</Text>
        <Text style={estilos.derecha}>Emitido el {formatFecha(datos.fecha_emision)}</Text>
      </View>
    </View>
  )
}

export function Partes({ datos }: BloqueProps) {
  const roles = ROLES_CONTRATO[datos.tipo]
  const { negocio, contraparte } = datos
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.seccionTitulo}>Partes</Text>
      <View style={estilos.partes}>
        <View style={estilos.parte}>
          <Text style={estilos.negrita}>{roles.negocio}</Text>
          <Text>{negocio.razon_social}</Text>
          <Text>RIF {negocio.rif}</Text>
          <Text>{negocio.direccion}</Text>
          <Text>Tel. {negocio.telefono}</Text>
        </View>
        <View style={estilos.parte}>
          <Text style={estilos.negrita}>{roles.contraparte}</Text>
          <Text>{contraparte.nombre}</Text>
          <Text>
            {textoTipoPersona(contraparte.tipo_persona)} · RIF/CI {contraparte.rif_ci}
          </Text>
          <Text>{contraparte.direccion ?? 'Dirección: No registrada'}</Text>
          {contraparte.telefono ? <Text>Tel. {contraparte.telefono}</Text> : null}
          {contraparte.tipo_persona === 'juridica' && contraparte.representantes.length > 0 ? (
            <View style={{ marginTop: 4 }}>
              <Text style={estilos.negrita}>Representantes legales</Text>
              {contraparte.representantes.map((r, i) => (
                <Text key={i}>
                  {r.nombre} · C.I. {r.cedula}
                  {r.cargo ? ` · ${r.cargo}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

export function DocumentoOrigen({ datos }: BloqueProps) {
  const { documento } = datos
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.seccionTitulo}>Documento de origen y plazo</Text>
      <Text>
        {referenciaDocumento(datos)}
        {datos.tipo === 'venta_credito' ? `, de fecha ${formatFecha(documento.fecha)}` : ''}
        {documento.moneda ? ` · Moneda pactada: ${documento.moneda === 'usd' ? 'USD' : 'Bs'}` : ''}
      </Text>
      <Text>
        Plazo del crédito: <Text style={estilos.negrita}>{textoDias(datos.dias_credito)}</Text> · Vence el{' '}
        <Text style={estilos.negrita}>{formatFecha(datos.fecha_vencimiento)}</Text>
      </Text>
    </View>
  )
}

export function TablaItems({ datos, etiquetaPrecio }: BloqueProps & { etiquetaPrecio: string }) {
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.seccionTitulo}>Detalle</Text>
      <View style={estilos.tabla}>
        <View style={[estilos.filaTabla, estilos.cabeceraTabla]} fixed>
          <Text style={estilos.colProducto}>Producto</Text>
          <Text style={estilos.colNum}>Peso</Text>
          <Text style={estilos.colNum}>{etiquetaPrecio}</Text>
          <Text style={estilos.colNum}>Subtotal USD</Text>
        </View>
        {datos.items.map((item, i) => (
          <View key={i} style={estilos.filaTabla} wrap={false}>
            <Text style={estilos.colProducto}>
              {item.codigo ? `${item.codigo} · ` : ''}
              {item.producto}
            </Text>
            <Text style={estilos.colNum}>{formatKg(item.peso_kg)}</Text>
            <Text style={estilos.colNum}>{formatUsd(item.precio_usd_kg)}</Text>
            <Text style={estilos.colNum}>{formatUsd(item.subtotal_usd)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function FilaTotal({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.filaTotal}>
      <Text>{etiqueta}</Text>
      <Text>{valor}</Text>
    </View>
  )
}

export function Totales({ datos }: BloqueProps) {
  const { totales } = datos
  const tasa = datos.tasa.tasa_snapshot
  const venta = datos.tipo === 'venta_credito'
  return (
    <View style={[estilos.seccion, estilos.totales]} wrap={false}>
      {venta ? (
        <>
          <FilaTotal etiqueta="Subtotal" valor={formatUsd(totales.subtotal_usd)} />
          <FilaTotal etiqueta={`IVA (${totales.iva_pct ?? 0}%)`} valor={formatUsd(totales.iva_usd ?? 0)} />
        </>
      ) : null}
      <View style={[estilos.filaTotal, estilos.negrita]}>
        <Text>Total USD</Text>
        <Text>{formatUsd(totales.total_usd)}</Text>
      </View>
      <FilaTotal etiqueta="Equivalente a la tasa pactada" valor={bs(totales.total_usd, tasa)} />
      <FilaTotal etiqueta="Abonos a la fecha" valor={`- ${formatUsd(totales.pagado_usd)}`} />
      {venta ? (
        <FilaTotal etiqueta="Notas de crédito emitidas" valor={`- ${formatUsd(totales.creditos_usd)}`} />
      ) : null}
      <View style={estilos.filaSaldo}>
        <Text>Saldo adeudado</Text>
        <Text>{formatUsd(totales.saldo_usd)}</Text>
      </View>
      <FilaTotal etiqueta="Equivalente a la tasa pactada" valor={bs(totales.saldo_usd, tasa)} />
    </View>
  )
}

export function TasaPactada({ datos }: BloqueProps) {
  return (
    <View style={estilos.seccion} wrap={false}>
      <Text style={estilos.seccionTitulo}>Tasa pactada</Text>
      <Text>
        <Text style={estilos.negrita}>{formatTasa(datos.tasa.tasa_snapshot)} Bs por USD</Text>.{' '}
        {describirTasa(datos.tasa)}.
      </Text>
    </View>
  )
}

export function Clausula({ datos }: BloqueProps) {
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.seccionTitulo}>Ganancia o pérdida cambiaria</Text>
      <Text style={estilos.parrafo}>{textoClausulaGananciaCambiaria(datos.tasa.tasa_snapshot)}</Text>
    </View>
  )
}

export function Notas({ datos }: BloqueProps) {
  if (!datos.notas) return null
  return (
    <View style={estilos.seccion}>
      <Text style={estilos.seccionTitulo}>Notas</Text>
      <Text style={estilos.parrafo}>{datos.notas}</Text>
    </View>
  )
}

export function Firmas({ datos }: BloqueProps) {
  const roles = ROLES_CONTRATO[datos.tipo]
  return (
    <View style={estilos.firmas} wrap={false}>
      <View style={estilos.firma}>
        <Text style={estilos.negrita}>Por {roles.negocio}</Text>
        <Text>{datos.negocio.razon_social}</Text>
        <Text>RIF {datos.negocio.rif}</Text>
      </View>
      <View style={estilos.firma}>
        <Text style={estilos.negrita}>Por {roles.contraparte}</Text>
        <Text>{datos.contraparte.nombre}</Text>
        <Text>RIF/CI {datos.contraparte.rif_ci}</Text>
      </View>
    </View>
  )
}

export function Pie({ datos }: BloqueProps) {
  return (
    <View style={estilos.pie} fixed>
      <Text>
        Documento interno, no fiscal · Contrato {numeroContrato(datos.numero)}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}
