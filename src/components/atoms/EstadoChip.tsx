'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Chip, { type ChipProps } from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import type { SxProps, Theme } from '@mui/material/styles'

export type EstadoTono = 'error' | 'warning' | 'success' | 'neutral'

export interface EstadoChipProps {
  /** Tono semántico del estado: error, warning, success o neutral */
  tono?: EstadoTono
  /** Compatibilidad con color de MUI / appDataGridColumns */
  color?: ChipProps['color']
  label: React.ReactNode
  tooltip?: React.ReactNode
  className?: string
  sx?: SxProps<Theme>
}

function resolveTono(tono?: EstadoTono, color?: ChipProps['color']): EstadoTono {
  if (tono) return tono
  if (color === 'error') return 'error'
  if (color === 'warning') return 'warning'
  if (color === 'success') return 'success'
  return 'neutral'
}

/**
 * Chip de estado compacto (22 px de alto, radio 4, texto 12/600) con punto indicador de 6 px.
 * Usa colores `soft` (fondo) y `onSoft` (texto) del theme.
 * Tonos disponibles: `error`, `warning`, `success` y `neutral`.
 */
export function EstadoChip({
  tono,
  color,
  label,
  tooltip,
  className,
  sx,
}: EstadoChipProps) {
  const resolvedTono = resolveTono(tono, color)

  const chip = (
    <Chip
      size="small"
      variant="soft"
      color={resolvedTono}
      className={className}
      label={label}
      tabIndex={tooltip ? 0 : undefined}
      icon={
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            minWidth: 6,
            borderRadius: '50%',
            backgroundColor: (theme) =>
              theme.palette[resolvedTono]?.dot ?? theme.palette[resolvedTono]?.main,
            ml: '6px !important',
            mr: '-2px !important',
            flexShrink: 0,
          }}
        />
      }
      sx={{
        fontWeight: 600,
        fontSize: '0.75rem',
        ...sx,
      }}
    />
  )

  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow>
        {chip}
      </Tooltip>
    )
  }

  return chip
}
