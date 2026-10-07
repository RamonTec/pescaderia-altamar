'use client'

import * as React from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import { NumericFormat, type NumberFormatValues } from 'react-number-format'

export interface NumberFieldProps
  extends Omit<TextFieldProps, 'value' | 'onChange' | 'type' | 'defaultValue' | 'select' | 'multiline'> {
  value: number | null | undefined
  onChange: (value: number | null) => void
  /** Cantidad de decimales visibles. Default 2. */
  decimals?: number
  prefix?: string
  suffix?: string
  /** `true` para admitir negativos (default `false`). */
  allowNegative?: boolean
}

/**
 * Input numérico estándar (spec 00 § Estructura visual): construido sobre
 * `NumericFormat`, los caracteres no numéricos se bloquean en vivo (no
 * aparecen ni se guardan). Interfaz pública en `number | null` para
 * react-hook-form; no usar `<input type="number">` plano.
 */
export function NumberField({
  value,
  onChange,
  decimals = 2,
  prefix,
  suffix,
  allowNegative = false,
  ...rest
}: NumberFieldProps) {
  const startAdornment = prefix ? (
    <InputAdornment position="start">{prefix}</InputAdornment>
  ) : undefined
  const endAdornment = suffix ? (
    <InputAdornment position="end">{suffix}</InputAdornment>
  ) : undefined

  const handleValueChange = (values: NumberFormatValues) => {
    onChange(values.value === '' ? null : values.floatValue ?? null)
  }

  return (
    <NumericFormat
      {...(rest as object)}
      customInput={TextField}
      type="text"
      inputMode="decimal"
      value={value ?? ''}
      onValueChange={handleValueChange}
      decimalScale={decimals}
      allowNegative={allowNegative}
      thousandSeparator="."
      decimalSeparator=","
      allowedDecimalSeparators={[',', '.']}
      slotProps={{
        input: {
          startAdornment,
          endAdornment,
        },
      }}
    />
  )
}