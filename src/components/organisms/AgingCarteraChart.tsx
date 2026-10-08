'use client'

import * as React from 'react'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import type { BloqueDashboard, TramoAging } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { ETIQUETA_TRAMO_AGING } from '@/lib/dashboard/etiquetas'
import { formatEntero, formatUsd, formatUsdCorto } from '@/lib/format'

/**
 * Antigüedad de la cartera (15, C1): saldo USD de facturas con saldo por
 * tramo (por vencer, 1–15, 16–30, > 30 días vencida). Σ tramos = CxC del día.
 */
export function AgingCarteraChart({ aging }: { aging: BloqueDashboard<TramoAging[]> }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const tramos = aging.ok ? aging.data : []
  const nombres = tramos.map((t) => ETIQUETA_TRAMO_AGING[t.tramo])
  const total = tramos.reduce((s, t) => s + t.saldo_usd, 0)

  return (
    <ChartCard
      title="Antigüedad de la cartera"
      help={`Saldo por cobrar a hoy: ${formatUsd(total)}.`}
      error={aging.ok ? null : aging.error}
      empty={tramos.every((t) => t.facturas === 0)}
      emptyTitle="No hay saldos por cobrar"
      skeletonHeight={240}
    >
      <BarChart
        height={240}
        xAxis={[
          {
            scaleType: 'band',
            data: nombres,
            colorMap: {
              type: 'ordinal',
              values: nombres,
              colors: [c.positivo, c.advertencia, c.costo, c.negativo],
            },
          },
        ]}
        yAxis={[{ valueFormatter: (v: number) => formatUsdCorto(v), width: 64 }]}
        series={[
          {
            data: tramos.map((t) => t.saldo_usd),
            label: 'Saldo',
            valueFormatter: (v, { dataIndex }) => {
              const t = tramos[dataIndex]
              return `${formatUsd(v ?? 0)}${t ? ` · ${formatEntero(t.facturas)} ${t.facturas === 1 ? 'factura' : 'facturas'}` : ''}`
            },
          },
        ]}
        hideLegend
        aria-label="Barras: saldo por cobrar por tramo de vencimiento"
      />
      <ChartLegendTable
        caption="Antigüedad de la cartera"
        rows={tramos}
        getRowKey={(t) => t.tramo}
        columns={[
          { key: 'tramo', label: 'Tramo', render: (t) => ETIQUETA_TRAMO_AGING[t.tramo] },
          { key: 'n', label: 'Facturas', align: 'right', render: (t) => formatEntero(t.facturas) },
          { key: 'saldo', label: 'Saldo', align: 'right', render: (t) => formatUsd(t.saldo_usd) },
        ]}
      />
    </ChartCard>
  )
}
