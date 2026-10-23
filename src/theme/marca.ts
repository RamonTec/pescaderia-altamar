/**
 * Constantes de marca de Altamar Sea Food (identidad «Peñero»,
 * 00-estandares-ui): fuente única de los hex de `palette.brand` para lo que
 * vive fuera de MUI (PDF de react-pdf, 21-cotizaciones). `theme.ts` los lee
 * de aquí; nunca se repiten sueltos en plantillas.
 */

export interface MarcaPaleta {
  /** Casco: color de títulos y bordes en documentos. */
  hull: string
  hullDeep: string
  onHull: string
  onHullMuted: string
  /** Franjas de la borda: ocre, blanca (trim) y roja. */
  ochre: string
  trim: string
  red: string
}

/** Paleta `brand` del modo claro (la de los documentos impresos). */
export const MARCA_CLARO: MarcaPaleta = {
  hull: '#0E4A5C',
  hullDeep: '#0A3644',
  onHull: '#EAF2F3',
  onHullMuted: '#A9C6CD',
  ochre: '#E8B931',
  red: '#B8402E',
  trim: '#EAF2F3',
}

/** Paleta `brand` del modo oscuro. */
export const MARCA_OSCURO: MarcaPaleta = {
  hull: '#123F4E',
  hullDeep: '#0A2A35',
  onHull: '#EAF2F3',
  onHullMuted: '#9DBFC7',
  ochre: '#D9A92A',
  red: '#B8402E',
  trim: '#C9D8DB',
}

/** Nombre comercial por defecto (si `config_negocio.nombre_comercial` está vacío). */
export const NOMBRE_MARCA = 'Altamar Sea Food'
