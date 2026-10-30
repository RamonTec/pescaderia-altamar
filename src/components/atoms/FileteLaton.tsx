'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import { MOTION } from '@/theme/tokens'

/** Duración de un barrido del filete (`variant="sweep"`). */
export const FILETE_SWEEP_MS = 1400

export interface FileteLatonProps {
  /**
   * `rule`: filete fijo (decorativo de marca, bajo el logo o un encabezado).
   * `sweep`: un tramo que barre de izquierda a derecha (progreso
   * indeterminado). Quieto a todo el ancho con `prefers-reduced-motion`.
   */
  variant?: 'rule' | 'sweep'
  /** Alto en px. */
  height?: number
  /** Ancho del filete (`rule`) o del contenedor (`sweep`). */
  width?: number | string
  /** `sweep`: fondo tenue detrás del barrido. */
  track?: boolean
  sx?: SxProps<Theme>
}

/**
 * Filete de latón (`brand.brass`): el decorativo de la identidad Puerto. Lo
 * usan el logo, los layouts de auth y documento público, el sidebar, la barra
 * de navegación y el loader global. `@keyframes puerto-sweep` vive en
 * globals.css.
 */
export function FileteLaton({
  variant = 'rule',
  height = 2,
  width = '100%',
  track = false,
  sx,
}: FileteLatonProps) {
  if (variant === 'rule') {
    return (
      <Box
        aria-hidden
        sx={[{ height, width, bgcolor: 'brand.brass', flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
      />
    )
  }
  return (
    <Box
      aria-hidden
      sx={[
        {
          height,
          width,
          overflow: 'hidden',
          borderRadius: height > 4 ? '2px' : 0,
          bgcolor: track ? 'background.subtle' : 'transparent',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          height: '100%',
          width: '30%',
          bgcolor: 'brand.brass',
          animation: `puerto-sweep ${FILETE_SWEEP_MS}ms ${MOTION.curvas.entrada} infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', width: '100%' },
        }}
      />
    </Box>
  )
}
