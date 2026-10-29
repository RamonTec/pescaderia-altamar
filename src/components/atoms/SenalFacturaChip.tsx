'use client'

import * as React from 'react'
import type { ChipProps } from '@mui/material/Chip'
import { EstadoChip, type EstadoTono } from '@/components/atoms/EstadoChip'
import { ETIQUETA_INDICADOR, ETIQUETA_SENAL, NIVEL_DE_SENAL } from '@/lib/facturas/senales'
import type { IndicadorLinea, NivelSenal, SenalFactura } from '@/types/domain'

/** Tono del chip por nivel sobre EstadoChip: error = Pérdida, aviso = Por debajo / Cobro mayor. */
export const TONO_NIVEL_SENAL: Record<NivelSenal, EstadoTono> = {
  ok: 'success',
  aviso: 'warning',
  error: 'error',
}

/** Color del chip por nivel (conservado por compatibilidad). */
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
 * Señal de posible error de una línea de factura (17) sobre `EstadoChip`:
 * rojo para Pérdida, ámbar para Por debajo / Cobro mayor y neutro para los
 * indicadores. El tooltip explica la regla con las cifras. Informativa.
 */
export function SenalFacturaChip({ tipo, tooltip }: SenalFacturaChipProps) {
  const senal = esSenal(tipo)
  const tono: EstadoTono = senal ? TONO_NIVEL_SENAL[NIVEL_DE_SENAL[tipo]] : 'neutral'
  const label = senal ? ETIQUETA_SENAL[tipo] : ETIQUETA_INDICADOR[tipo]

  return <EstadoChip tono={tono} label={label} tooltip={tooltip} />
}

/** Nivel de una factura (el peor de sus líneas) con el conteo de señales sobre `EstadoChip`. */
export function NivelSenalChip({ nivel, texto }: { nivel: NivelSenal; texto: string }) {
  return (
    <EstadoChip
      tono={TONO_NIVEL_SENAL[nivel]}
      label={nivel === 'ok' ? 'Sin señales de error' : texto}
    />
  )
}
