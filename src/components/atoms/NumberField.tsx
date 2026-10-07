'use client'

import * as React from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'

export interface NumberFieldProps
  extends Omit<TextFieldProps, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  value: number | null | undefined
  onChange: (value: number | null) => void
  /** Cantidad de decimales al formatear en blur. Default 2. */
  decimals?: number
  prefix?: string
  suffix?: string
}

function display(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return value.toFixed(decimals)
}

function parseInput(raw: string): number | null {
  const cleaned = raw.trim()
  if (!cleaned) return null

  const normalized = cleaned.replace(/[^\d.,-]/g, '')
  if (!normalized || normalized === '-') return null

  const lastDot = normalized.lastIndexOf('.')
  const lastComma = normalized.lastIndexOf(',')
  const decimalIdx = Math.max(lastDot, lastComma)

  if (decimalIdx === -1) {
    const n = Number(normalized.replace(/,/g, ''))
    return Number.isNaN(n) ? null : n
  }

  const intPart = normalized.slice(0, decimalIdx).replace(/[.,]/g, '')
  const decPart = normalized.slice(decimalIdx + 1).replace(/[.,]/g, '')
  const sign = intPart.startsWith('-') ? '-' : ''
  const intClean = intPart.replace('-', '')

  if (!intClean && !decPart) return null
  const n = Number(`${sign}${intClean || '0'}.${decPart}`)
  return Number.isNaN(n) ? null : n
}

export function NumberField({
  value,
  onChange,
  decimals = 2,
  prefix,
  suffix,
  ...rest
}: NumberFieldProps) {
  const [text, setText] = React.useState(() => display(value, decimals))
  const focusedRef = React.useRef(false)

  React.useEffect(() => {
    if (!focusedRef.current) {
      setText(display(value, decimals))
    }
  }, [value, decimals])

  const startAdornment = prefix ? (
    <InputAdornment position="start">{prefix}</InputAdornment>
  ) : undefined
  const endAdornment = suffix ? (
    <InputAdornment position="end">{suffix}</InputAdornment>
  ) : undefined

  return (
    <TextField
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        focusedRef.current = true
        rest.onFocus?.(e)
      }}
      onBlur={(e) => {
        focusedRef.current = false
        const parsed = parseInput(text)
        if (parsed !== null) setText(parsed.toFixed(decimals))
        else setText(display(value, decimals))
        rest.onBlur?.(e)
      }}
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        onChange(parseInput(next))
      }}
      slotProps={{
        input: {
          startAdornment,
          endAdornment,
        },
      }}
    />
  )
}
