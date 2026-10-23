/**
 * Constantes de marca de Altamar Sea Food (identidades «Peñero» y «Puerto»,
 * 00-estandares-ui): fuente única de los hex de `palette.brand` para lo que
 * vive fuera de MUI (PDF de react-pdf, 21-cotizaciones). `theme.ts` los lee
 * de aquí; nunca se repiten sueltos en plantillas.
 */

export interface MarcaPaleta {
  /** Casco: color de títulos y bordes en documentos (Peñero, compat). */
  hull: string
  hullDeep: string
  onHull: string
  onHullMuted: string
  /** Franjas de la borda: ocre, blanca (trim) y roja (Peñero, compat). */
  ochre: string
  trim: string
  red: string

  /** Identidad «Puerto» (00-estandares-ui Fase 3). */
  midnight: string
  navy: string
  onMidnight: string
  onMidnightMuted: string
  brass: string
  brassText: string
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
  // Puerto
  midnight: '#0B1B33',
  navy: '#1C2E4D',
  onMidnight: '#F7F6F2',
  onMidnightMuted: '#A3ADBD',
  brass: '#C9A66B',
  brassText: '#7A5C2E',
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
  // Puerto (P-UI10)
  midnight: '#0A1424',
  navy: '#1C2E4D',
  onMidnight: '#EEF0F4',
  onMidnightMuted: '#A3ADBD',
  brass: '#D4B27A',
  brassText: '#D4B27A',
}

/** Nombre comercial por defecto (si `config_negocio.nombre_comercial` está vacío). */
export const NOMBRE_MARCA = 'Altamar Sea Food'

