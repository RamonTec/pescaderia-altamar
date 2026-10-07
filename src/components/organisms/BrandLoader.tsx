'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { BrandMark } from '@/components/atoms/BrandMark'
import { PeneroSweep } from '@/components/atoms/PeneroStripes'

export interface BrandLoaderProps {
  open: boolean
  /** Qué está pasando, en `body2` ("Generando contrato"). */
  message?: string
  /**
   * `fixed` (por defecto): cubre toda la pantalla. `contained`: ocupa su
   * contenedor (página de muestra).
   */
  position?: 'fixed' | 'contained'
}

/**
 * Loader global con logo (nivel 1, ver spec § Loaders). Normalmente no se
 * usa directo: lo controla `useGlobalLoader()` (retardo de 150 ms, mínimo de
 * 400 ms, contador). Con `prefers-reduced-motion`: logo estático y franjas
 * quietas.
 */
export function BrandLoader({ open, message, position = 'fixed' }: BrandLoaderProps) {
  const theme = useTheme()
  return (
    <Fade
      in={open}
      timeout={{
        enter: theme.transitions.duration.shorter,
        exit: theme.transitions.duration.shortest,
      }}
      unmountOnExit
    >
      <Box
        role="status"
        aria-live="polite"
        aria-busy
        sx={{
          position: position === 'fixed' ? 'fixed' : 'absolute',
          inset: 0,
          zIndex: position === 'fixed' ? theme.zIndex.modal + 1 : 1,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          px: 2,
        }}
      >
        <Box
          sx={{
            animation: `penero-bob 2400ms ${theme.transitions.easing.easeInOut} infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <BrandMark orientation="vertical" size={112} />
        </Box>
        <Box sx={{ width: 220 }}>
          <PeneroSweep height={10} blockWidth="38%" track />
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: '75ch', textAlign: 'center' }}
        >
          {message ?? 'Cargando'}
        </Typography>
      </Box>
    </Fade>
  )
}
