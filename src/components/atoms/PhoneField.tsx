'use client'

import * as React from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import { PatternFormat } from 'react-number-format'

export interface PhoneFieldProps
  extends Omit<TextFieldProps, 'value' | 'onChange' | 'type' | 'defaultValue' | 'select' | 'multiline'> {
  value: string
  onChange: (value: string) => void
}

/** Quita todo lo que no sea dígito y normaliza el prefijo `+58`/`58`. */
export function normalizarTelefono(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0058')) digits = digits.slice(4)
  else if (digits.startsWith('58')) digits = digits.slice(2)
  return digits
}

/**
 * Teléfono venezolano con máscara `0414-1234567` (spec 00 § Estructura
 * visual). Normaliza el prefijo `+58`/`58` y espacios al escribir o pegar.
 * Todo campo de teléfono de la app usa este componente; la validación de
 * formato sigue siendo del esquema zod (`TELEFONO_VE_REGEX`).
 */
export function PhoneField({ value, onChange, ...rest }: PhoneFieldProps) {
  return (
    <PatternFormat
      {...(rest as object)}
      customInput={TextField}
      type="tel"
      inputMode="tel"
      format="####-#######"
      mask="_"
      value={normalizarTelefono(value)}
      onValueChange={(values) => onChange(values.value)}
      autoComplete="tel"
    />
  )
}