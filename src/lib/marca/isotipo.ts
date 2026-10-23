/**
 * Geometría del isotipo PROVISIONAL de Altamar (proa de peñero con las
 * franjas de la borda), compartida por `atoms/BrandMark` (SVG en la app) y
 * `lib/pdf/marca.tsx` (react-pdf). `src/app/icon.svg` es una copia estática
 * de estas mismas coordenadas. Cuando llegue el logo real se reemplaza aquí.
 */

export const ISOTIPO_VIEWBOX = '0 0 64 40'
export const ISOTIPO_ANCHO = 64
export const ISOTIPO_ALTO = 40

/** Casco. */
export const ISOTIPO_CASCO = 'M2 10 L9 14 H61 L52 34 Q50 37 46 37 H16 Q12 37 10 34 Z'

/** Franjas de la borda, de arriba abajo. */
export const ISOTIPO_FRANJAS = {
  ochre: '9,14 61,14 59.4,18 10.2,18',
  trim: '10.2,18 59.4,18 58.8,19.6 10.7,19.6',
  red: '10.7,19.6 58.8,19.6 57.2,23.6 11.9,23.6',
} as const
