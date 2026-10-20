'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { etiquetaIva } from '@/lib/facturas/iva'
import { totalesDe, type TotalesFactura } from '@/lib/facturas/totales'
import { formatUsd } from '@/lib/format'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

/** Línea en captura: peso o precio `null` mientras el campo está vacío. */
export interface LineaVentaParcial {
  peso_kg?: number | null
  precio_usd_kg?: number | null
}

/**
 * Totales de una venta con las líneas capturadas (se omiten las incompletas)
 * y el `iva_pct` efectivo (0 = sin IVA). Mismo cálculo que la emisión.
 */
export function totalesVenta(items: readonly LineaVentaParcial[] | undefined, ivaPct: number): TotalesFactura {
  const lineas = (items ?? []).flatMap((i) =>
    i.peso_kg != null && i.precio_usd_kg != null ? [{ peso_kg: i.peso_kg, precio_usd_kg: i.precio_usd_kg }] : []
  )
  return totalesDe(lineas, ivaPct)
}

export interface TotalesVentaProps {
  totales: TotalesFactura
  /** `iva_pct` efectivo de la factura: 0 = «Sin IVA». */
  ivaPct: number
  /** Etiqueta del subtotal (por defecto «Subtotal»). */
  etiquetaSubtotal?: string
  /** Etiqueta del total (por defecto «Total USD»). */
  etiquetaTotal?: string
}

/**
 * Subtotal, IVA (`IVA (16 %)` o «Sin IVA») y total de una venta
 * (18-iva-opcional; POS, entrega de pedido y nota de crédito). Cifras
 * tabulares alineadas a la derecha, con `lib/format.ts`.
 */
export function TotalesVenta({
  totales,
  ivaPct,
  etiquetaSubtotal = 'Subtotal',
  etiquetaTotal = 'Total USD',
}: TotalesVentaProps) {
  const sinIva = !(ivaPct > 0)
  return (
    <Box
      component="dl"
      aria-label="Totales de la venta"
      sx={{
        m: 0,
        ml: 'auto',
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        columnGap: 3,
        rowGap: 0.5,
        alignItems: 'baseline',
        width: { xs: '100%', sm: 'auto' },
        minWidth: { sm: 260 },
        '& dt': { m: 0 },
        '& dd': { m: 0, textAlign: 'right', ...NUM },
      }}
    >
      <Typography component="dt" variant="body2" color="text.secondary">
        {etiquetaSubtotal}
      </Typography>
      <Typography component="dd" variant="body2">
        {formatUsd(totales.subtotal_usd)}
      </Typography>

      <Typography component="dt" variant="body2" color="text.secondary">
        {etiquetaIva(ivaPct)}
      </Typography>
      <Typography component="dd" variant="body2" color={sinIva ? 'text.secondary' : 'text.primary'}>
        {sinIva ? '—' : formatUsd(totales.iva_usd)}
      </Typography>

      <Typography component="dt" variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
        {etiquetaTotal}
      </Typography>
      <Typography component="dd" variant="h6" sx={{ ...NUM, pt: 0.5 }}>
        {formatUsd(totales.total_usd)}
      </Typography>
    </Box>
  )
}
