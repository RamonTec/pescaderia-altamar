'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { EstadoChip } from '@/components/atoms/EstadoChip'
import type { EstadoDocumental } from '@/types/domain'

export interface StatusChipsProps {
  bloqueado?: boolean
  motivoBloqueo?: string | null
  activo?: boolean
  documentacion?: EstadoDocumental
  /**
   * @deprecated En el nuevo design system (Fase 4), los estados normales como
   * "Activo" ya no se muestran como chip. Esta propiedad se conserva por compatibilidad
   * pero queda sin efecto.
   */
  mostrarActivo?: boolean
}

/**
 * Chips de estado de una entidad (cliente/proveedor) sobre `EstadoChip`:
 *   - Inactivo (neutral, solo si !activo; "Activo" ya no se muestra como chip)
 *   - Bloqueado (error, tooltip con el motivo)
 *   - Doc. incompleta (warning, tooltip con faltantes)
 * Sin chips que mostrar no renderiza nada.
 */
export function StatusChips({
  bloqueado = false,
  motivoBloqueo,
  activo = true,
  documentacion,
}: StatusChipsProps) {
  const docIncompleta = documentacion != null && !documentacion.completa
  const mostrarInactivo = !activo

  if (!mostrarInactivo && !bloqueado && !docIncompleta) return null

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {mostrarInactivo ? (
        <EstadoChip tono="neutral" label="Inactivo" />
      ) : null}
      {bloqueado ? (
        <EstadoChip
          tono="error"
          label="Bloqueado"
          tooltip={motivoBloqueo ? `Motivo: ${motivoBloqueo}` : 'Bloqueado'}
        />
      ) : null}
      {docIncompleta ? (
        <EstadoChip
          tono="warning"
          label="Doc. incompleta"
          tooltip={`Faltan: ${documentacion.faltantes.join(', ')}`}
        />
      ) : null}
    </Box>
  )
}
