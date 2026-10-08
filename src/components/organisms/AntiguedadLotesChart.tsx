'use client'

import * as React from 'react'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import type { BloqueDashboard, TramoAntiguedad } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { ETIQUETA_TRAMO_ANTIGUEDAD } from '@/lib/dashboard/etiquetas'
import { formatEntero, formatKg, formatKgCorto, formatUsd } from '@/lib/format'

/**
 * Antigüedad de lotes abiertos (15, agregado 1): kg por días en cava en tramos
 * fijos 0–2 / 3–5 / > 5 (D3). El USD solo llega al admin (`null` para el
 * operador) y solo entonces se muestra.
 */
export function AntiguedadLotesChart({ antiguedad }: { antiguedad: BloqueDashboard<TramoAntiguedad[]> }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const tramos = antiguedad.ok ? antiguedad.data : []
  const conUsd = tramos.some((t) => t.usd !== null)
  const etiquetas = tramos.map((t) => ETIQUETA_TRAMO_ANTIGUEDAD[t.tramo])

  return (
    <ChartCard
      title="Antigüedad de lotes abiertos"
      help="Kilos en cava por días desde su ingreso."
      error={antiguedad.ok ? null : antiguedad.error}
      empty={tramos.every((t) => t.lotes === 0)}
      emptyTitle="No hay lotes abiertos con stock"
      skeletonHeight={220}
    >
      <BarChart
        height={220}
        xAxis={[
          {
            scaleType: 'band',
            data: etiquetas,
            colorMap: { type: 'ordinal', values: etiquetas, colors: [c.positivo, c.advertencia, c.negativo] },
          },
        ]}
        yAxis={[{ valueFormatter: (v: number) => formatKgCorto(v), width: 64 }]}
        series={[
          {
            data: tramos.map((t) => t.kg),
            label: 'Kilos',
            valueFormatter: (v, { dataIndex }) => {
              const t = tramos[dataIndex]
              const lotes = t ? ` · ${formatEntero(t.lotes)} ${t.lotes === 1 ? 'lote' : 'lotes'}` : ''
              const usd = t && t.usd !== null ? ` · ${formatUsd(t.usd)}` : ''
              return `${formatKg(v ?? 0)}${lotes}${usd}`
            },
          },
        ]}
        hideLegend
        aria-label="Gráfico de barras: kilos de lotes abiertos por antigüedad"
      />
      <ChartLegendTable
        caption="Antigüedad de lotes abiertos"
        rows={tramos}
        getRowKey={(t) => t.tramo}
        columns={[
          { key: 'tramo', label: 'Días en cava', render: (t) => ETIQUETA_TRAMO_ANTIGUEDAD[t.tramo] },
          { key: 'lotes', label: 'Lotes', align: 'right', render: (t) => formatEntero(t.lotes) },
          { key: 'kg', label: 'Kilos', align: 'right', render: (t) => formatKg(t.kg) },
          ...(conUsd
            ? [{ key: 'usd', label: 'Valor', align: 'right' as const, render: (t: TramoAntiguedad) => formatUsd(t.usd ?? 0) }]
            : []),
        ]}
      />
    </ChartCard>
  )
}
