'use client'

import * as React from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'

export interface RifCiFieldProps
  extends Omit<TextFieldProps, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  /** Etiqueta dinámica: "RIF" para jurídica, "Cédula" para natural. */
  label?: string
}

/**
 * Input para RIF/cédula con máscara ligera: normaliza a mayúsculas y
 * fuerza el prefijo V-/E-/J-. No impone el formato completo (eso lo valida
 * zod en el formulario); aquí solo facilita la escritura.
 */
export function RifCiField({ value, onChange, label = 'RIF / Cédula', ...rest }: RifCiFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value.toUpperCase().trim()

    if (next.length === 1 && /^[VEJG]$/.test(next)) {
      next = `${next}-`
    }

    onChange(next)
  }

  return (
    <TextField
      {...rest}
      label={label}
      value={value}
      onChange={handleChange}
      slotProps={{
        htmlInput: {
          maxLength: 14,
          autoCapitalize: 'characters',
          autoCorrect: 'off',
          ...rest.slotProps?.htmlInput,
        },
      }}
    />
  )
}
