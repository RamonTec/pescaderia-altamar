'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { ChartCard } from '@/components/molecules/ChartCard'
import type { BloqueDashboard, DashboardGastos } from '@/types/domain'
import { formatPct, formatUsd } from '@/lib/format'

function Fila({
  titulo,
  detalle,
  valor,
  fuerte = false,
  porcentaje = null,
}: {
  titulo: string
  detalle?: string
  valor: number
  fuerte?: boolean
  porcentaje?: number | null
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant={fuerte ? 'subtitle1' : 'body2'} component="p">
          {titulo}
        </Typography>
        {detalle ? (
          <Typography variant="caption" color="text.secondary" component="p">
            {detalle}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography
          variant={fuerte ? 'h5' : 'body1'}
          component="p"
          sx={{
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            color: fuerte
              ? valor < 0
                ? 'error.main'
                : valor > 0
                  ? 'success.main'
                  : 'text.primary'
              : 'text.primary',
          }}
        >
          {formatUsd(valor)}
        </Typography>
        {porcentaje !== null && porcentaje !== undefined ? (
          <Typography
            variant="caption"
            sx={{
              fontVariantNumeric: 'tabular-nums',
              color: valor < 0 ? 'error.main' : 'text.secondary',
            }}
            component="p"
          >
            {formatPct(porcentaje)} sobre ventas
          </Typography>
        ) : null}
      </Box>
    </Box>
  )
}

export interface UtilidadNetaCardProps {
  gastos: BloqueDashboard<DashboardGastos>
}

/**
 * Tarjeta de utilidad neta del período (20-gastos, Fase D).
 * Utilidad neta = margen bruto (B3) − gastos confirmados del período.
 * El resultado cambiario no se suma (regla de 15).
 */
export function UtilidadNetaCard({ gastos }: UtilidadNetaCardProps) {
  const g = gastos.ok ? gastos.data : null
  const u = g?.utilidad ?? null

  return (
    <ChartCard
      title="Utilidad neta"
      help="Margen bruto de ventas menos gastos operativos confirmados del período. El resultado cambiario sigue aparte."
      error={gastos.ok ? null : gastos.error}
      empty={u !== null && u.ventas_usd === 0 && u.gastos_usd === 0}
      emptyTitle="Sin ventas ni gastos registrados en el período"
      skeletonHeight={220}
    >
      {u ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Fila
            titulo="Ventas netas"
            detalle="Sin IVA, netas de notas de crédito"
            valor={u.ventas_usd}
          />
          <Fila
            titulo="Margen bruto"
            detalle="Ventas − costo de lotes vendidos"
            valor={u.margen_bruto_usd}
          />
          <Fila
            titulo="Gastos operativos"
            detalle="Gastos confirmados del período"
            valor={u.gastos_usd}
          />
          <Divider />
          <Fila
            titulo="Utilidad neta"
            detalle="Margen bruto − gastos"
            valor={u.utilidad_neta_usd}
            porcentaje={u.margen_neto_pct}
            fuerte
          />
        </Box>
      ) : null}
    </ChartCard>
  )
}
