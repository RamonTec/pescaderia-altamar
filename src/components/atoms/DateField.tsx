'use client'

import * as React from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { DatePicker, type DatePickerProps } from '@mui/x-date-pickers/DatePicker'
import type { SxProps, Theme } from '@mui/material/styles'

export interface DateFieldProps {
  /** Valor en formato ISO `YYYY-MM-DD` o null/undefined */
  value: string | null | undefined
  /** Callback que recibe el valor en formato ISO `YYYY-MM-DD` o null */
  onChange: (value: string | null) => void
  label?: string
  /** Fecha mínima permitida en formato ISO `YYYY-MM-DD` */
  minDate?: string
  /** Fecha máxima permitida en formato ISO `YYYY-MM-DD` */
  maxDate?: string
  error?: boolean
  helperText?: React.ReactNode
  disabled?: boolean
  required?: boolean
  size?: 'small' | 'medium'
  fullWidth?: boolean
  sx?: SxProps<Theme>
  className?: string
  name?: string
  id?: string
  slotProps?: DatePickerProps['slotProps']
}

/**
 * Campo de selección de fecha sobre `DatePicker` de `@mui/x-date-pickers`.
 *
 * - Recibe y emite fechas en formato ISO `YYYY-MM-DD` | `null`.
 * - Muestra la fecha en formato `DD/MM/YYYY` (`29/10/2026`).
 * - Tamaño `small` (40 px) y ancho mínimo de 160 px por defecto.
 * - Compatible directamente con `react-hook-form` vía `<Controller>`.
 */
export function DateField({
  value,
  onChange,
  label,
  minDate,
  maxDate,
  error,
  helperText,
  disabled = false,
  required = false,
  size = 'small',
  fullWidth = false,
  sx,
  className,
  name,
  id,
  slotProps,
}: DateFieldProps) {
  const dayjsValue = React.useMemo(() => {
    if (!value) return null
    const d = dayjs(value, 'YYYY-MM-DD')
    return d.isValid() ? d : null
  }, [value])

  const dayjsMinDate = React.useMemo(() => {
    if (!minDate) return undefined
    const d = dayjs(minDate, 'YYYY-MM-DD')
    return d.isValid() ? d : undefined
  }, [minDate])

  const dayjsMaxDate = React.useMemo(() => {
    if (!maxDate) return undefined
    const d = dayjs(maxDate, 'YYYY-MM-DD')
    return d.isValid() ? d : undefined
  }, [maxDate])

  const handleChange = (date: Dayjs | null) => {
    if (date && date.isValid()) {
      onChange(date.format('YYYY-MM-DD'))
    } else {
      onChange(null)
    }
  }

  return (
    <DatePicker
      value={dayjsValue}
      onChange={handleChange}
      label={label}
      format="DD/MM/YYYY"
      minDate={dayjsMinDate}
      maxDate={dayjsMaxDate}
      disabled={disabled}
      className={className}
      slotProps={{
        ...slotProps,
        textField: {
          size,
          error,
          helperText,
          required,
          fullWidth,
          name,
          id,
          sx: {
            minWidth: 160,
            ...sx,
          },
          ...slotProps?.textField,
        },
      }}
    />
  )
}
