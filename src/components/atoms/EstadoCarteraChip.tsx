'use client'

import * as React from 'react'
import type { ChipProps } from '@mui/material/Chip'
import { EstadoChip, type EstadoTono } from '@/components/atoms/EstadoChip'
import { ETIQUETA_ESTADO } from '@/lib/cartera/estado'
import type { EstadoCartera } from '@/lib/cartera/types'

/** Tono de cada estado de cartera sobre EstadoChip (Anulada pasa a neutral). */
export const TONO_ESTADO_CARTERA: Record<EstadoCartera, EstadoTono> = {
  vencida: 'error',
  por_vencer: 'warning',
  pendiente: 'warning',
  pagada: 'success',
  anulada: 'neutral',
}

/** Color de cada estado de cartera (conservado por compatibilidad). */
export const COLOR_ESTADO_CARTERA: Record<EstadoCartera, NonNullable<ChipProps['color']>> = {
  vencida: 'error',
  por_vencer: 'warning',
  pendiente: 'warning',
  pagada: 'success',
  anulada: 'neutral',
}

/**
 * Estado de cobro/pago de un documento de cartera (09-cuentas-por-cobrar):
 * chip `soft` de 22 px con punto sobre `EstadoChip`. Sirve igual para facturas y compras.
 */
export function EstadoCarteraChip({ estado }: { estado: EstadoCartera }) {
  return (
    <EstadoChip tono={TONO_ESTADO_CARTERA[estado]} label={ETIQUETA_ESTADO[estado]} />
  )
}
