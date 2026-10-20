'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { formatIvaPct } from '@/lib/facturas/iva'

export interface IvaVentaSwitchProps {
  /** `true` = la factura lleva IVA (al % de configuración). */
  value: boolean
  onChange: (aplica: boolean) => void
  /** `config_negocio.iva_pct` vigente (el % que se aplica si está encendido). */
  ivaPct: number
  /**
   * `clientes.aplica_iva` del cliente elegido (lo habitual). `null` = sin
   * cliente: no hay aviso de "distinto a lo habitual".
   */
  habitualCliente: boolean | null
  disabled?: boolean
  error?: boolean
  helperText?: React.ReactNode
}

/**
 * Interruptor de IVA de una venta (18-iva-opcional; POS y entrega de
 * pedido): "Factura con IVA (16 %)", precargado con el "Aplica IVA" del
 * cliente. Cambiarlo afecta solo esa factura; si difiere de lo habitual del
 * cliente lo avisa. Controlado (integrable con `react-hook-form` vía
 * `Controller` o `setValue`).
 */
export function IvaVentaSwitch({
  value,
  onChange,
  ivaPct,
  habitualCliente,
  disabled,
  error,
  helperText,
}: IvaVentaSwitchProps) {
  const distinto = habitualCliente !== null && value !== habitualCliente
  const ayudaId = React.useId()

  return (
    <Box sx={{ display: 'grid', gap: 0.25 }}>
      <FormControlLabel
        control={
          <Switch
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            slotProps={{ input: { 'aria-describedby': distinto || helperText ? ayudaId : undefined } }}
          />
        }
        label={`Factura con IVA (${formatIvaPct(ivaPct)})`}
        sx={{ mr: 0, alignSelf: 'flex-start' }}
      />
      {distinto || helperText ? (
        <Typography
          id={ayudaId}
          variant="caption"
          color={error ? 'error' : 'text.secondary'}
          sx={{ fontWeight: helperText ? 400 : 600 }}
        >
          {helperText ?? `Este cliente normalmente ${habitualCliente ? 'sí' : 'no'} lleva IVA`}
        </Typography>
      ) : null}
    </Box>
  )
}
