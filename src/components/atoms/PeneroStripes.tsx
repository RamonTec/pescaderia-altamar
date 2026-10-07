'use client'

import Box from '@mui/material/Box'

/**
 * Franjas de borda de peñero: el único elemento decorativo de la identidad.
 * Se "pintan" de izquierda a derecha una sola vez al montar; sin animación
 * con `prefers-reduced-motion: reduce`. `@keyframes penero-paint` vive en
 * globals.css.
 */
const STRIPES = [
  { color: 'brand.ochre', height: { xs: 8, md: 14 } },
  { color: 'brand.trim', height: { xs: 3, md: 6 } },
  { color: 'brand.red', height: { xs: 8, md: 14 } },
  { color: 'brand.hullDeep', height: { xs: 0, md: 22 } },
] as const

/**
 * Franjas que barren de izquierda a derecha: progreso indeterminado.
 * Lo usan `NavigationProgress` (3 px) y `BrandLoader` (10 px). Con
 * `prefers-reduced-motion` las franjas quedan quietas a todo el ancho.
 * `@keyframes penero-sweep` vive en globals.css.
 */
export function PeneroSweep({
  height,
  blockWidth = '30%',
  track = false,
}: {
  /** Alto total en px (las franjas se reparten 2:1:2). */
  height: number
  /** Ancho del bloque que barre. */
  blockWidth?: string
  /** Fondo tenue detrás del barrido. */
  track?: boolean
}) {
  return (
    <Box
      aria-hidden
      sx={{
        height,
        width: '100%',
        overflow: 'hidden',
        borderRadius: height > 4 ? '2px' : 0,
        bgcolor: track ? 'action.hover' : 'transparent',
      }}
    >
      <Box
        sx={(theme) => ({
          height: '100%',
          width: blockWidth,
          display: 'grid',
          gridTemplateRows: '2fr 1fr 2fr',
          animation: `penero-sweep 1400ms ${theme.transitions.easing.easeInOut} infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', width: '100%' },
        })}
      >
        <Box sx={{ bgcolor: 'brand.ochre' }} />
        <Box sx={{ bgcolor: 'brand.trim' }} />
        <Box sx={{ bgcolor: 'brand.red' }} />
      </Box>
    </Box>
  )
}

export function PeneroStripes() {
  return (
    <Box aria-hidden sx={{ display: 'grid' }}>
      {STRIPES.map((stripe, i) => (
        <Box
          key={stripe.color}
          sx={(theme) => ({
            height: stripe.height,
            bgcolor: stripe.color,
            transformOrigin: 'left',
            animation: `penero-paint ${theme.transitions.duration.complex}ms ${theme.transitions.easing.easeOut} both`,
            animationDelay: `${i * 90}ms`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          })}
        />
      ))}
    </Box>
  )
}
