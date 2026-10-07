'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined'
import { useNotify } from '@/lib/useNotify'

export interface CopyableTextProps {
  value: string
  /** Muestra el valor enmascarado en vez del completo (ej. cuenta). */
  display?: string
  mono?: boolean
  /** Variante del texto (por defecto `body2`); ej. `h5` para el código de un lote. */
  variant?: TypographyProps['variant']
  /** Texto del toast al copiar. */
  copiedMessage?: string
}

/**
 * Texto con botón de copiar al portapapeles + toast "Copiado".
 * Útil para datos de pago (cuenta, teléfono, RIF, email) que se usan al
 * pagarle al proveedor.
 */
export function CopyableText({
  value,
  display,
  mono = true,
  variant = 'body2',
  copiedMessage = 'Copiado',
}: CopyableTextProps) {
  const notify = useNotify()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      notify.success(copiedMessage)
    } catch {
      notify.error('No se pudo copiar')
    }
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Typography
        variant={variant}
        sx={mono ? { fontVariantNumeric: 'tabular-nums' } : undefined}
      >
        {display ?? value}
      </Typography>
      <Tooltip title="Copiar">
        <IconButton aria-label={`Copiar ${value}`} size="small" onClick={handleCopy}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
