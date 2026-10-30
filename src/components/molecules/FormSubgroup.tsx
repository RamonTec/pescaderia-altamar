'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface FormSubgroupProps {
  /** Nombre del subgrupo ("Tasa", "Pago"). */
  etiqueta: string
  children: React.ReactNode
}

/**
 * Subgrupo dentro de una sección de formulario (spec § Design system ›
 * Patrones › Formulario): una etiqueta `label` y su contenido, sin divisor.
 * No es un título de sección: para eso está `FormSection`.
 */
export function FormSubgroup({ etiqueta, children }: FormSubgroupProps) {
  const etiquetaId = React.useId()
  return (
    <Box role="group" aria-labelledby={etiquetaId} sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
      <Typography id={etiquetaId} variant="label" component="div">
        {etiqueta}
      </Typography>
      {children}
    </Box>
  )
}
