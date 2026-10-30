'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { BrandMark } from '@/components/atoms/BrandMark'
import { FileteLaton } from '@/components/atoms/FileteLaton'
import { NOMBRE_MARCA } from '@/theme/marca'

export interface BrandLoaderProps {
  open: boolean
  /** Qué está pasando, en `body2` ("Generando contrato…"). */
  message?: string
  /**
   * `scrim` (por defecto): sobre la página, que se intuye detrás (operación
   * larga). `pagina`: tapa todo con `background.default` (entrar, salir).
   */
  fondo?: 'scrim' | 'pagina'
  /**
   * `fixed` (por defecto): cubre toda la pantalla. `contained`: ocupa su
   * contenedor (página de muestra).
   */
  position?: 'fixed' | 'contained'
}

/**
 * Loader global (spec § Carga y feedback › Operación larga): isotipo,
 * «Altamar Sea Food» en `h3`, filete de latón que barre y el mensaje.
 * Normalmente no se usa directo: lo controla `useGlobalLoader()` (retardo,
 * mínimo y contador desde `TIEMPOS`). Con `prefers-reduced-motion` el filete
 * queda quieto.
 */
export function BrandLoader({ open, message, fondo = 'scrim', position = 'fixed' }: BrandLoaderProps) {
  const theme = useTheme()
  const sobreScrim = fondo === 'scrim'
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
          bgcolor: sobreScrim ? 'scrim' : 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textAlign: 'center',
            // Sobre el scrim, la marca va en una superficie elevada.
            ...(sobreScrim
              ? {
                  bgcolor: 'background.elevated',
                  borderRadius: '8px',
                  px: 5,
                  py: 4,
                  boxShadow: 'none',
                }
              : {}),
          }}
        >
          <BrandMark variant="isotipo" size={72} />
          <Typography variant="h3" component="p">
            {NOMBRE_MARCA}
          </Typography>
          <FileteLaton variant="sweep" height={3} width={200} track />
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch' }}>
            {message ?? 'Cargando'}
          </Typography>
        </Box>
      </Box>
    </Fade>
  )
}
