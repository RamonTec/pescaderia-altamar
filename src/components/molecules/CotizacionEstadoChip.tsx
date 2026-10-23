'use client'

import Chip, { type ChipProps } from '@mui/material/Chip'
import { ETIQUETA_ESTADO_COTIZACION } from '@/lib/cotizaciones/estado'
import type { EstadoEfectivoCotizacion } from '@/types/domain'

const COLOR: Record<EstadoEfectivoCotizacion, NonNullable<ChipProps['color']>> = {
  borrador: 'default',
  enviada: 'info',
  vencida: 'warning',
  aceptada: 'success',
  rechazada: 'error',
  anulada: 'default',
}

/** Estado de una cotización (21) como chip `soft` de 22 px; `vencida` es derivada. */
export function CotizacionEstadoChip({ estado }: { estado: EstadoEfectivoCotizacion }) {
  return (
    <Chip
      size="small"
      variant={estado === 'anulada' ? 'outlined' : 'soft'}
      color={COLOR[estado]}
      label={ETIQUETA_ESTADO_COTIZACION[estado]}
    />
  )
}
