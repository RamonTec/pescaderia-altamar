'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import { formatFecha, formatHace, formatTasaCorta } from '@/lib/format'
import type { OrigenTasa } from '@/types/domain'

/**
 * Dato de una tasa vigente, recortado del `TasasHoy` del server
 * (`getTasasVigentesHoy`): lo justo para pintar el chip y su tooltip.
 */
export interface TasaIndicadorDato {
  /** Bs por 1 USD. */
  valor: number
  fecha_valor: string
  origen: OrigenTasa
  publicada_en: string | null
  arrastrada: boolean
}

export interface TasaIndicadorProps {
  /** BCV USD (en `xs` es lo único visible). */
  bcv: TasaIndicadorDato | null
  /** BCV EUR (oculto en `xs`). */
  bcvEur: TasaIndicadorDato | null
}

const ORIGEN_LABEL: Record<OrigenTasa, string> = {
  bcv_scraping: 'BCV',
  dolarapi: 'dolarapi',
  manual: 'manual',
}

function tooltipLineas(t: TasaIndicadorDato): string {
  const partes = [
    `Fecha valor: ${formatFecha(t.fecha_valor)}`,
    `Origen: ${ORIGEN_LABEL[t.origen]}`,
  ]
  if (t.publicada_en) partes.push(`Actualizada ${formatHace(t.publicada_en)}`)
  if (t.arrastrada) partes.push('Arrastrada de un día anterior')
  return partes.join(' · ')
}

/**
 * Chip compacto de la barra superior con las vigentes de hoy (08-tasas):
 * "BCV $ 873,87 · € 984,26" (en `xs` solo el USD). Tooltip con fecha valor,
 * origen y hora de actualización; ícono de advertencia si la tasa está
 * arrastrada de un día anterior. Clic → `/tasas`. Puro display.
 */
export function TasaIndicador({ bcv, bcvEur }: TasaIndicadorProps) {
  if (!bcv) return null

  const label = (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
        BCV ${formatTasaCorta(bcv.valor)}
      </Box>
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        BCV ${formatTasaCorta(bcv.valor)}
        {bcvEur ? ` · € ${formatTasaCorta(bcvEur.valor)}` : ''}
      </Box>
      {bcv.arrastrada ? (
        <WarningAmberOutlinedIcon sx={{ fontSize: 16 }} aria-hidden />
      ) : null}
    </Box>
  )

  return (
    <Tooltip
      title={
        <Box sx={{ display: 'grid', gap: 0.25 }}>
          <Typography variant="caption">
            BCV $ {formatTasaCorta(bcv.valor)} — {tooltipLineas(bcv)}
          </Typography>
          {bcvEur ? (
            <Typography variant="caption">
              BCV € {formatTasaCorta(bcvEur.valor)} — {tooltipLineas(bcvEur)}
            </Typography>
          ) : null}
        </Box>
      }
      enterDelay={150}
    >
      <Chip
        component={Link}
        href="/tasas"
        size="small"
        variant="outlined"
        clickable
        label={label}
        aria-label="Ir a tasas"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          color: bcv.arrastrada ? 'warning.main' : 'text.secondary',
          borderColor: bcv.arrastrada ? 'warning.main' : 'divider',
        }}
      />
    </Tooltip>
  )
}