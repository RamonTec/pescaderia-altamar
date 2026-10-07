'use client'

import * as React from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import { NumberFormatBase } from 'react-number-format'

export interface RifCiFieldProps
  extends Omit<TextFieldProps, 'value' | 'onChange' | 'type' | 'defaultValue' | 'select' | 'multiline'> {
  value: string
  onChange: (value: string) => void
}

/** Letra válida de inicio: V (venezolano), E (extranjero), J (jurídico), G (gubernamental). */
const LETRA_RIF_CI = /[VEJG]/

/**
 * Quita de lo escrito/pegado todo lo que no sirva: letra inicial válida,
 * dígitos y el guion del dígito verificador. La letra solo cuenta si va
 * primera (o tras un `V-`/`J-` ya formateado al pegar).
 */
function quitarFormatoRifCi(raw: string): string {
  const limpio = raw
    .toUpperCase()
    .replace(/\+/g, '')
    .replace(/\s+/g, '')
    .replace(/--+/g, '-')
  const m = /^([VEJG])?-?(\d*)-?(\d?)$/.exec(limpio)
  if (!m) {
    // Pegados raros: conserva la primera letra válida + todos los dígitos.
    const letra = limpio.match(LETRA_RIF_CI)?.[0] ?? ''
    const digitos = limpio.replace(/\D/g, '')
    return `${letra}${digitos}`
  }
  const [, letra, digitos, verificador] = m
  return `${letra ?? ''}${digitos}${verificador ?? ''}`.slice(0, 12)
}

/**
 * Formatea el crudo `V123456789` en `V-123456789` (verificador opcional con
 * guion: `J-123456789-0`). El crudo nunca lleva los guiones: los pone la
 * máscara. Sin contenido devuelve '' (placeholder visible).
 */
function formatRifCi(crudo: string): string {
  if (!crudo) return ''
  const letra = crudo[0]
  const resto = crudo.slice(1)
  if (!LETRA_RIF_CI.test(letra)) return crudo
  // Hasta 10 dígitos; un 11.º es el dígito verificador, con guion.
  const verificador = resto.length > 10 ? `-${resto.slice(10)}` : ''
  const digitos = resto.slice(0, 10)
  return `${letra}-${digitos}${verificador}`
}

/**
 * Input para RIF/cédula (spec 00 § Estructura visual): máscara completa
 * `V-12345678` / `J-123456789-0` sobre `NumberFormatBase` — letra limitada
 * a `V|E|J|G`, guion automático tras la letra, hasta 10 dígitos + dígito
 * verificador opcional. Los caracteres inválidos se bloquean en vivo. La
 * validación de formato sigue siendo del esquema zod (`RIF_CI_REGEX`).
 */
export function RifCiField({ value, onChange, ...rest }: RifCiFieldProps) {
  return (
    <NumberFormatBase
      {...(rest as object)}
      customInput={TextField}
      type="text"
      inputMode="text"
      value={quitarFormatoRifCi(value)}
      format={formatRifCi}
      removeFormatting={quitarFormatoRifCi}
      onValueChange={(values) => onChange(values.formattedValue)}
      slotProps={{
        htmlInput: {
          autoCapitalize: 'characters',
          autoCorrect: 'off',
          maxLength: 14,
          ...(rest.slotProps as { htmlInput?: object } | undefined)?.htmlInput,
        },
      }}
    />
  )
}