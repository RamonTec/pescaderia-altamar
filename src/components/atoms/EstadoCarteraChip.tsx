'use client'

import * as React from 'react'
import Chip, { type ChipProps } from '@mui/material/Chip'
import { ETIQUETA_ESTADO } from '@/lib/cartera/estado'
import type { EstadoCartera } from '@/lib/cartera/types'

/** Color de cada estado de cartera (chip `soft`, también lo usan tarjetas e indicador). */
export const COLOR_ESTADO_CARTERA: Record<EstadoCartera, NonNullable<ChipProps['color']>> = {
  vencida: 'error',
  por_vencer: 'warning',
  pendiente: 'info',
  pagada: 'success',
  anulada: 'default',
}

/**
 * Estado de cobro/pago de un documento de cartera (09-cuentas-por-cobrar):
 * chip `soft` de 22 px. Sirve igual para facturas y, después, compras.
 */
export function EstadoCarteraChip({ estado }: { estado: EstadoCartera }) {
  return (
    <Chip size="small" variant="soft" color={COLOR_ESTADO_CARTERA[estado]} label={ETIQUETA_ESTADO[estado]} />
  )
}
