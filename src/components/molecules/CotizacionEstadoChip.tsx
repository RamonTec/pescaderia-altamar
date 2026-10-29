'use client'

import * as React from 'react'
import Typography from '@mui/material/Typography'
import { EstadoChip, type EstadoTono } from '@/components/atoms/EstadoChip'
import { ETIQUETA_ESTADO_COTIZACION } from '@/lib/cotizaciones/estado'
import type { EstadoEfectivoCotizacion } from '@/types/domain'

const TONO: Record<Exclude<EstadoEfectivoCotizacion, 'enviada' | 'aceptada'>, EstadoTono> = {
  borrador: 'neutral',
  vencida: 'error',
  rechazada: 'neutral',
  anulada: 'neutral',
}

/**
 * Estado de una cotización (21) sobre `EstadoChip`:
 *   - Borrador, Rechazada y Anulada: neutral
 *   - Vencida: error
 *   - Enviada y Aceptada: como texto sin chip (estados normales, spec § Primitivos)
 */
export function CotizacionEstadoChip({ estado }: { estado: EstadoEfectivoCotizacion }) {
  if (estado === 'enviada' || estado === 'aceptada') {
    return (
      <Typography
        component="span"
        sx={{
          fontSize: '0.75rem',
          fontWeight: 500,
          color: 'text.secondary',
          lineHeight: '22px',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {ETIQUETA_ESTADO_COTIZACION[estado]}
      </Typography>
    )
  }

  return (
    <EstadoChip tono={TONO[estado]} label={ETIQUETA_ESTADO_COTIZACION[estado]} />
  )
}
