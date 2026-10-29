'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { ESPACIO } from '@/theme/tokens'

export interface FormSectionProps {
  titulo: string
  /** Texto de ayuda en `body2` bajo el título (ej. "Déjalo vacío si compra de contado"). */
  ayuda?: string
  /** Menos aire entre campos (16 px), para formularios cortos en `AppDialog sm`. */
  dense?: boolean
  /** Se acepta por compatibilidad; desde la Fase 4 no cambia nada. */
  primera?: boolean
  children: React.ReactNode
}

/**
 * Sección estándar de formulario (spec § Design system › Patrones ›
 * Formulario): título `sectionTitle` + ayuda opcional, divisor **inferior** y
 * 16 px hasta el contenido. Los campos van de a uno con 24 px entre ellos, o
 * en un `FormGrid`.
 *
 * Los 40 px entre secciones los pone el contenedor del formulario
 * (`gap: ESPACIO.formSecciones`), así la primera no lleva margen.
 *
 * Es un `role="group"` con `aria-labelledby` en lugar de `fieldset` +
 * `legend`: el `legend` dentro de una grilla se montaba sobre la ayuda.
 */
export function FormSection({ titulo, ayuda, dense = false, children }: FormSectionProps) {
  const tituloId = React.useId()
  return (
    <Box role="group" aria-labelledby={tituloId} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          pb: 1,
          mb: ESPACIO.formTituloAContenido,
          borderBottom: 1,
          borderColor: 'divider',
          // Dentro de lo elevado (modal), el divisor del modal.
          '.MuiDialog-paper &': { borderColor: 'dialogDivider' },
        }}
      >
        <Typography id={tituloId} variant="sectionTitle" component="h3" sx={{ m: 0 }}>
          {titulo}
        </Typography>
        {ayuda ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {ayuda}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ display: 'grid', gap: dense ? 2 : ESPACIO.formCampoVertical, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  )
}
