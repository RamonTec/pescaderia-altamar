'use client'

import * as React from 'react'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import type { EstadoDocumental } from '@/types/domain'

export interface StatusChipsProps {
  bloqueado?: boolean
  motivoBloqueo?: string | null
  activo?: boolean
  documentacion?: EstadoDocumental
}

/**
 * Chips de estado de una entidad (cliente/proveedor):
 *   - Bloqueado (error, tooltip con el motivo)
 *   - Doc. incompleta (warning, tooltip con faltantes)
 *   - Inactivo (default)
 */
export function StatusChips({
  bloqueado = false,
  motivoBloqueo,
  activo = true,
  documentacion,
}: StatusChipsProps) {
  if (bloqueado) {
    return (
      <Tooltip title={motivoBloqueo || 'Bloqueado'}>
        <Chip label="Bloqueado" size="small" color="error" />
      </Tooltip>
    )
  }

  const docIncompleta = documentacion != null && !documentacion.completa

  return (
    <Box sx={{ display: 'inline-flex', gap: 0.5, flexWrap: 'wrap' }}>
      {docIncompleta ? (
        <Tooltip title={`Faltan: ${documentacion.faltantes.join(', ')}`}>
          <Chip label="Doc. incompleta" size="small" color="warning" />
        </Tooltip>
      ) : null}
      {activo ? null : (
        <Chip label="Inactivo" size="small" color="default" variant="outlined" />
      )}
    </Box>
  )
}
