import { Path, Polygon, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import { MARCA_CLARO, NOMBRE_MARCA } from '@/theme/marca'
import { ISOTIPO_ALTO, ISOTIPO_ANCHO, ISOTIPO_CASCO, ISOTIPO_FILETE, ISOTIPO_VIEWBOX } from '@/lib/marca/isotipo'
import type { NegocioDocumento } from '@/types/domain'
import type { FuentesPdf } from './fuentes'

/**
 * Piezas de marca para los PDF de react-pdf (21-cotizaciones; reutilizables):
 * encabezado con el isotipo (mismas coordenadas que `atoms/BrandMark`), el
 * nombre y los datos del negocio, y las franjas de la borda como filete (el
 * único gesto decorativo); pie con número de página. Colores solo de
 * `src/theme/marca.ts` (modo claro). Puros: datos → elementos.
 */

const GRIS = MARCA_CLARO.hullDeep

export function estilosMarca(f: FuentesPdf) {
  return StyleSheet.create({
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    nombre: { ...f.titulo, fontSize: 18, color: MARCA_CLARO.hull },
    datos: { fontSize: 8.5, color: GRIS, marginTop: 2 },
    franjas: { marginTop: 10, marginBottom: 14 },
    pie: {
      position: 'absolute',
      left: 48,
      right: 48,
      bottom: 24,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7.5,
      color: GRIS,
      borderTopWidth: 0.5,
      borderTopColor: MARCA_CLARO.hull,
      paddingTop: 6,
    },
  })
}

export function IsotipoPdf({ ancho = 56 }: { ancho?: number }) {
  return (
    <Svg viewBox={ISOTIPO_VIEWBOX} width={ancho} height={(ancho * ISOTIPO_ALTO) / ISOTIPO_ANCHO}>
      <Path d={ISOTIPO_CASCO} fill={MARCA_CLARO.midnight} />
      <Polygon points={ISOTIPO_FILETE} fill={MARCA_CLARO.brass} />
    </Svg>
  )
}

/** Franjas de la borda (ocre, blanca, roja) a todo el ancho. */
export function FranjasBorda() {
  return (
    <View>
      <View style={{ height: 4, backgroundColor: MARCA_CLARO.ochre }} />
      <View style={{ height: 1.5, backgroundColor: MARCA_CLARO.trim }} />
      <View style={{ height: 4, backgroundColor: MARCA_CLARO.red }} />
    </View>
  )
}

export function EncabezadoMarca({ negocio, fuentes }: { negocio: NegocioDocumento; fuentes: FuentesPdf }) {
  const e = estilosMarca(fuentes)
  const lineas = [
    negocio.razon_social && negocio.razon_social !== negocio.nombre_comercial ? negocio.razon_social : null,
    negocio.rif ? `RIF ${negocio.rif}` : null,
    negocio.direccion,
    negocio.telefono ? `Tel. ${negocio.telefono}` : null,
  ].filter((l): l is string => Boolean(l))
  return (
    <View>
      <View style={e.encabezado}>
        <IsotipoPdf />
        <View style={{ flex: 1 }}>
          <Text style={e.nombre}>{negocio.nombre_comercial || NOMBRE_MARCA}</Text>
          {lineas.length > 0 ? <Text style={e.datos}>{lineas.join(' · ')}</Text> : null}
        </View>
      </View>
      <View style={e.franjas}>
        <FranjasBorda />
      </View>
    </View>
  )
}

/** Pie fijo en cada página: texto a la izquierda y «Página N de M». */
export function PiePagina({ texto, fuentes }: { texto: string; fuentes: FuentesPdf }) {
  const e = estilosMarca(fuentes)
  return (
    <View style={e.pie} fixed>
      <Text>{texto}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}
