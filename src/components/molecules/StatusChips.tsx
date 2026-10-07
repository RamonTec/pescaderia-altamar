'use client'

import * as React from 'react'
import Chip, { type ChipProps } from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import type { EstadoDocumental } from '@/types/domain'

export interface StatusChipsProps {
  bloqueado?: boolean
  motivoBloqueo?: string | null
  activo?: boolean
  documentacion?: EstadoDocumental
  /**
   * Pinta "Activo" cuando la entidad está activa. En listados sí (la columna
   * Estado nunca queda vacía); en tarjetas `xs` y fichas no, porque solo se
   * muestran los chips que informan algo.
   */
  mostrarActivo?: boolean
}

function EstadoChip({ label, color }: { label: string; color: NonNullable<ChipProps['color']> }) {
  // `size="small"` = 22 px y `variant="soft"`: tokens del theme (MuiChip).
  return <Chip label={label} size="small" variant="soft" color={color} />
}

/**
 * Chips de estado de una entidad (cliente/proveedor), en `soft` de 22 px:
 *   - Activo (success, solo con `mostrarActivo`) / Inactivo (default)
 *   - Bloqueado (error, tooltip con el motivo); convive con Activo/Inactivo
 *   - Doc. incompleta (warning, tooltip con faltantes)
 * Sin chips que mostrar no renderiza nada.
 */
export function StatusChips({
  bloqueado = false,
  motivoBloqueo,
  activo = true,
  documentacion,
  mostrarActivo = false,
}: StatusChipsProps) {
  const docIncompleta = documentacion != null && !documentacion.completa
  const mostrarEstadoActivo = activo ? mostrarActivo : true

  if (!mostrarEstadoActivo && !bloqueado && !docIncompleta) return null

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {mostrarEstadoActivo ? (
        activo ? (
          <EstadoChip label="Activo" color="success" />
        ) : (
          <EstadoChip label="Inactivo" color="default" />
        )
      ) : null}
      {bloqueado ? (
        <Tooltip title={motivoBloqueo ? `Motivo: ${motivoBloqueo}` : 'Bloqueado'}>
          <Chip label="Bloqueado" size="small" variant="soft" color="error" />
        </Tooltip>
      ) : null}
      {docIncompleta ? (
        <Tooltip title={`Faltan: ${documentacion.faltantes.join(', ')}`}>
          <Chip label="Doc. incompleta" size="small" variant="soft" color="warning" />
        </Tooltip>
      ) : null}
    </Box>
  )
}
