'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import { ESPACIO } from '@/theme/tokens'

export interface FormGridProps {
  children: React.ReactNode
  sx?: SxProps<Theme>
}

/**
 * Grilla de campos de formulario (spec § Design system › Patrones ›
 * Formulario): 1 columna en `xs` y 2 en `sm+`, 24 px vertical y 16 px entre
 * columnas. Un campo sin pareja (notas, teléfono suelto) va dentro de
 * `FormGrid.Full` para ocupar el ancho completo y no quedar huérfano.
 */
export function FormGrid({ children, sx }: FormGridProps) {
  return (
    <Box
      sx={[
        {
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          rowGap: ESPACIO.formCampoVertical,
          columnGap: ESPACIO.formColumnas,
          minWidth: 0,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  )
}

function FormGridFull({ children }: { children: React.ReactNode }) {
  return <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>{children}</Box>
}

FormGrid.Full = FormGridFull
