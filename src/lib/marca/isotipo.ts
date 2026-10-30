/**
 * Geometría del isotipo PROVISIONAL de Altamar, identidad Puerto (P-UI4):
 * proa en medianoche con un filete de latón bajo la borda. La comparten
 * `atoms/BrandMark` (SVG en la app) y `lib/pdf/marca.tsx` (react-pdf).
 * `src/app/icon.svg` es una copia estática de estas mismas coordenadas.
 * Cuando llegue el logo real se reemplaza aquí.
 */

export const ISOTIPO_VIEWBOX = '0 0 64 40'
export const ISOTIPO_ANCHO = 64
export const ISOTIPO_ALTO = 40

/** Proa (casco). */
export const ISOTIPO_CASCO = 'M2 10 L9 14 H61 L52 34 Q50 37 46 37 H16 Q12 37 10 34 Z'

/** Filete de latón bajo la borda. */
export const ISOTIPO_FILETE = '10.4,18.6 59.2,18.6 58.4,20.6 11.2,20.6'
