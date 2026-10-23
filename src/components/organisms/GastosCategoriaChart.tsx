'use client'

import * as React from 'react'
import Link from 'next/link'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import type { BloqueDashboard, DashboardGastos, GastoPorCategoria } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { formatEntero, formatPct, formatUsd, formatUsdCorto } from '@/lib/format'

interface CategoriaAgrupada {
  categoria_id: string
  categoria: string
  total_usd: number
  n_gastos: number
}

export interface GastosCategoriaChartProps {
  gastos: BloqueDashboard<DashboardGastos>
  desde: string
  hasta: string
}

/**
 * Gráfico de barras horizontales de gastos por categoría (20-gastos, Fase D).
 * Barras horizontales por categoría de primer nivel con ChartCard + ChartLegendTable,
 * con enlace a /gastos?desde=...&hasta=...&categoria=...
 */
const EMPTY_FILAS: GastoPorCategoria[] = []

export function GastosCategoriaChart({ gastos, desde, hasta }: GastosCategoriaChartProps) {
  const theme = useTheme()
  const c = coloresGrafico(theme)

  const g = gastos.ok ? gastos.data : null
  const filasCrudas = g?.por_categoria ?? EMPTY_FILAS
  const totalPeriodo = g?.total_gastos_usd ?? 0

  const agrupadas = React.useMemo(() => {
    if (!gastos.ok) return []
    const mapa = new Map<string, CategoriaAgrupada>()
    for (const f of gastos.data.por_categoria) {
      const actual = mapa.get(f.categoria_id) ?? {
        categoria_id: f.categoria_id,
        categoria: f.categoria,
        total_usd: 0,
        n_gastos: 0,
      }
      actual.total_usd += f.total_usd
      actual.n_gastos += f.n_gastos
      mapa.set(f.categoria_id, actual)
    }
    return Array.from(mapa.values()).sort((a, b) => b.total_usd - a.total_usd)
  }, [gastos])

  const nombres = agrupadas.map((a) => a.categoria)

  return (
    <ChartCard
      title="Gastos por categoría"
      help={`Gastos confirmados del período. Total: ${formatUsd(totalPeriodo)}.`}
      error={gastos.ok ? null : gastos.error}
      empty={filasCrudas.length === 0 || totalPeriodo === 0}
      emptyTitle="Sin gastos confirmados en el período"
      skeletonHeight={240}
      action={
        <Button
          component={Link}
          href={`/gastos?desde=${desde}&hasta=${hasta}`}
          size="small"
        >
          Ver gastos
        </Button>
      }
    >
      <BarChart
        height={Math.max(160, agrupadas.length * 36 + 60)}
        layout="horizontal"
        yAxis={[{ scaleType: 'band', data: nombres, width: 140 }]}
        xAxis={[{ valueFormatter: (v: number) => formatUsdCorto(v) }]}
        series={[
          {
            data: agrupadas.map((a) => a.total_usd),
            label: 'Total USD',
            color: c.costo,
            valueFormatter: (v, { dataIndex }) => {
              const a = agrupadas[dataIndex]
              return `${formatUsd(v ?? 0)}${a ? ` · ${formatEntero(a.n_gastos)} gastos` : ''}`
            },
          },
        ]}
        hideLegend
        aria-label="Barras: gastos por categoría en USD"
      />
      <ChartLegendTable
        caption="Gastos por categoría y subcategoría"
        rows={filasCrudas}
        getRowKey={(f: GastoPorCategoria, i: number) => `${f.categoria_id}-${f.subcategoria_id ?? i}`}
        columns={[
          {
            key: 'categoria',
            label: 'Categoría',
            render: (f: GastoPorCategoria) => (
              <Button
                component={Link}
                href={`/gastos?desde=${desde}&hasta=${hasta}&categoria=${f.subcategoria_id ?? f.categoria_id}`}
                size="small"
                sx={{ p: 0, minWidth: 0, textTransform: 'none', textAlign: 'left', fontWeight: 'normal' }}
              >
                {f.subcategoria ? `${f.categoria} › ${f.subcategoria}` : f.categoria}
              </Button>
            ),
          },
          {
            key: 'n_gastos',
            label: 'Gastos',
            align: 'right',
            render: (f: GastoPorCategoria) => formatEntero(f.n_gastos),
          },
          {
            key: 'total_usd',
            label: 'Total USD',
            align: 'right',
            render: (f: GastoPorCategoria) => formatUsd(f.total_usd),
          },
          {
            key: 'pct',
            label: '% del total',
            align: 'right',
            render: (f: GastoPorCategoria) =>
              totalPeriodo > 0 ? formatPct(f.total_usd / totalPeriodo) : '—',
          },
        ]}
      />
    </ChartCard>
  )
}
