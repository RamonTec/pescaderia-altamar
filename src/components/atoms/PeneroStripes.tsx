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
