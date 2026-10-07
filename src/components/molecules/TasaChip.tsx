'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { formatFecha, formatTasa } from '@/lib/format'

const FUENTE_LABEL = { bcv: 'BCV', paralela: 'Paralela' } as const

export interface TasaChipProps {
  /** Valor en Bs/USD de la referencial. */
  valor: number
  /** Fuente de la referencial (BCV o paralela). */
  fuente: 'bcv' | 'paralela'
  /** Fecha valor: la fecha que rige la tasa (no la de consulta). */
  fechaValor: string
  /** `true` si la fecha valor es anterior a la fecha de la operación. */
  arrastrada?: boolean
}

/**
 * Chip de una tasa referencial (08-tasas): valor, fuente y fecha valor.
 * Si la tasa está arrastrada de un día anterior (fin de semana/feriado),
 * lo indica con su propio chip de advertencia. Puro display, sin lógica.
 */
export function TasaChip({ valor, fuente, fechaValor, arrastrada }: TasaChipProps) {
  return (
    <Box sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Chip
        size="small"
        variant="outlined"
        label={`${FUENTE_LABEL[fuente]} ${formatTasa(valor)}`}
      />
      <Typography variant="caption" color="text.secondary" component="span">
        valor {formatFecha(fechaValor)}
      </Typography>
      {arrastrada ? (
        <Tooltip title={`Rige desde el ${formatFecha(fechaValor)}: no hay tasa publicada más reciente`}>
          <Chip size="small" color="warning" label={`arrastrada del ${formatFecha(fechaValor)}`} />
        </Tooltip>
      ) : null}
    </Box>
  )
}