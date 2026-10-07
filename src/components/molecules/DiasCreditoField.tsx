'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { sumarDias } from '@/lib/cartera/estado'

const ATAJOS = [7, 15, 30] as const

const venceFormatter = new Intl.DateTimeFormat('es-VE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function textoVence(fecha: string, dias: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  const [y, m, d] = sumarDias(fecha, dias).split('-').map(Number)
  return venceFormatter.format(new Date(y, m - 1, d))
}

export interface DiasCreditoFieldProps {
  /** `null` = los habituales del cliente (se muestran como valor). */
  value: number | null | undefined
  onChange: (dias: number | null) => void
  /** Fecha de emisión (`YYYY-MM-DD`), para "Vence el …". */
  fecha: string
  /** Días habituales del cliente (o el default del negocio). */
  diasHabituales: number
  error?: boolean
  helperText?: React.ReactNode
  disabled?: boolean
}

/**
 * Días de crédito de una venta (09-cuentas-por-cobrar): entero 0–365
 * precargado con los habituales del cliente, atajos 7 / 15 / 30, "Vence el
 * lun 20/10/2026" en vivo y aviso si difiere de lo habitual. Solo se muestra
 * en ventas a crédito (en contado la factura vence el mismo día).
 */
export function DiasCreditoField({
  value,
  onChange,
  fecha,
  diasHabituales,
  error,
  helperText,
  disabled,
}: DiasCreditoFieldProps) {
  const dias = value ?? diasHabituales
  const valido = Number.isInteger(dias) && dias >= 0 && dias <= 365
  const vence = valido ? textoVence(fecha, dias) : null
  const distinto = valido && dias !== diasHabituales

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1.5 }}>
        <NumberField
          label="Días de crédito *"
          size="small"
          decimals={0}
          suffix="días"
          value={dias}
          onChange={onChange}
          disabled={disabled}
          error={error}
          helperText={helperText}
          sx={{ width: { xs: '100%', sm: 180 } }}
        />
        <Box role="group" aria-label="Atajos de días de crédito" sx={{ display: 'flex', gap: 1, pt: 0.75 }}>
          {ATAJOS.map((n) => (
            <Chip
              key={n}
              label={`${n} días`}
              variant={dias === n ? 'soft' : 'outlined'}
              color={dias === n ? 'primary' : 'default'}
              aria-pressed={dias === n}
              disabled={disabled}
              onClick={() => onChange(n)}
            />
          ))}
        </Box>
      </Box>
      {vence ? (
        <Typography variant="body2" color="text.secondary">
          Vence el {vence}
        </Typography>
      ) : null}
      {distinto ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Distinto a lo habitual del cliente ({diasHabituales} {diasHabituales === 1 ? 'día' : 'días'})
        </Typography>
      ) : null}
    </Box>
  )
}
