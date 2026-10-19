'use client'

import * as React from 'react'
import Chip, { type ChipProps } from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import { ETIQUETA_INDICADOR, ETIQUETA_SENAL, NIVEL_DE_SENAL } from '@/lib/facturas/senales'
import type { IndicadorLinea, NivelSenal, SenalFactura } from '@/types/domain'

/** Color del chip por nivel: error = Pérdida, aviso = Por debajo / Cobro mayor. */
export const COLOR_NIVEL_SENAL: Record<NivelSenal, NonNullable<ChipProps['color']>> = {
  ok: 'success',
  aviso: 'warning',
  error: 'error',
}

export interface SenalFacturaChipProps {
  /** Señal (Pérdida, Por debajo, Cobro mayor) o indicador neutro (Sin referencia, Sin costo). */
  tipo: SenalFactura | IndicadorLinea
  /** Regla con las cifras de la línea. */
  tooltip?: React.ReactNode
}

function esSenal(tipo: SenalFactura | IndicadorLinea): tipo is SenalFactura {
  return tipo in NIVEL_DE_SENAL
}

/**
 * Señal de posible error de una línea de factura (17): chip `soft` de 22 px,
 * rojo para Pérdida, ámbar para Por debajo / Cobro mayor y neutro para los
 * indicadores. El tooltip explica la regla con las cifras. Informativa.
 */
export function SenalFacturaChip({ tipo, tooltip }: SenalFacturaChipProps) {
  const senal = esSenal(tipo)
  const chip = (
    <Chip
      size="small"
      variant="soft"
      color={senal ? COLOR_NIVEL_SENAL[NIVEL_DE_SENAL[tipo]] : 'default'}
      label={senal ? ETIQUETA_SENAL[tipo] : ETIQUETA_INDICADOR[tipo]}
      tabIndex={tooltip ? 0 : undefined}
    />
  )
  return tooltip ? <Tooltip title={tooltip}>{chip}</Tooltip> : chip
}

/** Nivel de una factura (el peor de sus líneas) con el conteo de señales. */
export function NivelSenalChip({ nivel, texto }: { nivel: NivelSenal; texto: string }) {
  return (
    <Chip
      size="small"
      variant="soft"
      color={COLOR_NIVEL_SENAL[nivel]}
      label={nivel === 'ok' ? 'Sin señales de error' : texto}
    />
  )
}
