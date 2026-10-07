'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

export interface FormSectionProps {
  titulo: string
  /** Texto de ayuda en `body2` bajo el título (ej. "Déjalo vacío si compra de contado"). */
  ayuda?: string
  /** Menos aire entre secciones (16 px), para formularios cortos en `AppDialog xs`. */
  dense?: boolean
  /** `true` en la primera sección del formulario: omite el divisor superior. */
  primera?: boolean
  children: React.ReactNode
}

/**
 * Sección estándar de formulario (spec 00 § Estructura visual): título `h6`
 * + ayuda opcional + divisor de 1 px encima (salvo la primera sección).
 * 24 px entre secciones (`dense`: 16 px), 16 px entre campos.
 */
export function FormSection({ titulo, ayuda, dense = false, primera = false, children }: FormSectionProps) {
  return (
    <Box
      component="fieldset"
      sx={{
        border: 0,
        p: 0,
        m: 0,
        minWidth: 0,
        display: 'grid',
        gap: dense ? 1.5 : 2,
      }}
    >
      {primera ? null : <Divider sx={{ mb: dense ? 1.5 : 2 }} />}
      <Box component="legend" sx={{ p: 0 }}>
        <Typography variant="h6" component="span">
          {titulo}
        </Typography>
      </Box>
      {ayuda ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1.25 }}>
          {ayuda}
        </Typography>
      ) : null}
      {children}
    </Box>
  )
}