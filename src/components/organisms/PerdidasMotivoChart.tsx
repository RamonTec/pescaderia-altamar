'use client'

import * as React from 'react'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import type { BloqueDashboard, PerdidaPorMotivo } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { ETIQUETA_MOTIVO } from '@/lib/loteValidation'
import { formatEntero, formatKg, formatKgCorto, formatUsd } from '@/lib/format'

/**
 * Pérdidas fuera de proceso por motivo (15, B8): `perdidas_lote` del período
 * (dañado, vencido, faltante, cierre de lote, otro), kg y USD al costo del
 * lote, y n.º de registros.
 */
export function PerdidasMotivoChart({ perdidas }: { perdidas: BloqueDashboard<PerdidaPorMotivo[]> }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const filas = perdidas.ok ? perdidas.data : []
  const nombres = filas.map((f) => ETIQUETA_MOTIVO[f.motivo])
  const totalUsd = filas.reduce((s, f) => s + f.usd, 0)

  return (
    <ChartCard
      title="Pérdidas por motivo"
      help={`Fuera del procesamiento. Total del período: ${formatUsd(totalUsd)}.`}
      error={perdidas.ok ? null : perdidas.error}
      empty={filas.every((f) => f.registros === 0)}
      emptyTitle="Sin pérdidas registradas en el período"
      skeletonHeight={240}
    >
      <BarChart
        height={240}
        xAxis={[
          {
            scaleType: 'band',
            data: nombres,
            colorMap: { type: 'ordinal', values: nombres, colors: [...c.categorias] },
          },
        ]}
        yAxis={[{ valueFormatter: (v: number) => formatKgCorto(v), width: 64 }]}
        series={[
          {
            data: filas.map((f) => f.kg),
            label: 'Kilos',
            valueFormatter: (v, { dataIndex }) => {
              const f = filas[dataIndex]
              return `${formatKg(v ?? 0)}${f ? ` · ${formatUsd(f.usd)} · ${formatEntero(f.registros)} reg.` : ''}`
            },
          },
        ]}
        hideLegend
        aria-label="Barras: kilos perdidos por motivo"
      />
      <ChartLegendTable
        caption="Pérdidas por motivo"
        rows={filas}
        getRowKey={(f) => f.motivo}
        columns={[
          { key: 'motivo', label: 'Motivo', render: (f) => ETIQUETA_MOTIVO[f.motivo] },
          { key: 'n', label: 'Registros', align: 'right', render: (f) => formatEntero(f.registros) },
          { key: 'kg', label: 'Kilos', align: 'right', render: (f) => formatKg(f.kg) },
          { key: 'usd', label: 'Valor', align: 'right', render: (f) => formatUsd(f.usd) },
        ]}
      />
    </ChartCard>
  )
}
