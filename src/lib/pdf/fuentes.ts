import { existsSync } from 'node:fs'
import path from 'node:path'
import { Font } from '@react-pdf/renderer'

/**
 * Tipografía de marca para los PDF de react-pdf (21-cotizaciones, P6;
 * identidad Puerto): Instrument Sans 400/600 (cuerpo) y Fraunces 600
 * (títulos), desde TTF estáticos con licencia OFL en `src/lib/pdf/fuentes/`. Registro idempotente con ruta
 * absoluta (`process.cwd()`), solo en el servidor. Si falta algún archivo o
 * el registro falla, se usa Helvetica (integrada en react-pdf) y se avisa
 * por consola una vez. `next.config.ts` incluye la carpeta en el trazado de
 * los route handlers del PDF (`outputFileTracingIncludes`).
 */

export interface FuentesPdf {
  cuerpo: string
  cuerpoNegrita: { fontFamily: string; fontWeight: number }
  titulo: { fontFamily: string; fontWeight: number }
  /** `true` si se registraron las fuentes de marca; `false` = Helvetica de respaldo. */
  marca: boolean
}

export const DIRECTORIO_FUENTES = path.join(process.cwd(), 'src', 'lib', 'pdf', 'fuentes')

export const ARCHIVOS_FUENTES = {
  regular: 'InstrumentSans-Regular.ttf',
  semibold: 'InstrumentSans-SemiBold.ttf',
  tituloSemibold: 'Fraunces-SemiBold.ttf',
} as const

const HELVETICA: FuentesPdf = {
  cuerpo: 'Helvetica',
  cuerpoNegrita: { fontFamily: 'Helvetica-Bold', fontWeight: 400 },
  titulo: { fontFamily: 'Helvetica-Bold', fontWeight: 400 },
  marca: false,
}

const PUERTO: FuentesPdf = {
  cuerpo: 'Instrument Sans',
  cuerpoNegrita: { fontFamily: 'Instrument Sans', fontWeight: 600 },
  titulo: { fontFamily: 'Fraunces', fontWeight: 600 },
  marca: true,
}

let registradas: FuentesPdf | null = null

export function registrarFuentesMarca(): FuentesPdf {
  if (registradas) return registradas
  // Sin guiones automáticos: los nombres de producto no se cortan.
  Font.registerHyphenationCallback((palabra) => [palabra])
  try {
    const ruta = (archivo: string) => path.join(DIRECTORIO_FUENTES, archivo)
    const faltantes = Object.values(ARCHIVOS_FUENTES).filter((a) => !existsSync(ruta(a)))
    if (faltantes.length > 0) {
      console.warn(`[pdf] Faltan fuentes de marca (${faltantes.join(', ')}): se usa Helvetica`)
      registradas = HELVETICA
      return registradas
    }
    Font.register({
      family: 'Instrument Sans',
      fonts: [
        { src: ruta(ARCHIVOS_FUENTES.regular), fontWeight: 400 },
        { src: ruta(ARCHIVOS_FUENTES.semibold), fontWeight: 600 },
      ],
    })
    Font.register({
      family: 'Fraunces',
      fonts: [{ src: ruta(ARCHIVOS_FUENTES.tituloSemibold), fontWeight: 600 }],
    })
    registradas = PUERTO
  } catch (e) {
    console.warn('[pdf] No se pudieron registrar las fuentes de marca: se usa Helvetica', e)
    registradas = HELVETICA
  }
  return registradas
}
