'use client'

import * as React from 'react'
import Link from 'next/link'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import type { BloqueDashboard, ValorInventarioProducto } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { formatBs, formatEntero, formatKg, formatUsd, formatUsdCorto } from '@/lib/format'

/**
 * Valor del inventario por producto (15, agregado 2): los 10 de mayor valor y
 * el resto agrupado; USD = Σ stock × costo de sus lotes abiertos y Bs a la
 * tasa vigente de la fuente por defecto (mismo criterio que `/inventario`).
 */
export function ValorInventarioPanel({ valor }: { valor: BloqueDashboard<ValorInventarioProducto[]> }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const filas = valor.ok ? valor.data : []

  return (
    <ChartCard
      title="Valor del inventario por producto"
      help="A hoy. Lotes abiertos con stock al costo de cada lote."
      error={valor.ok ? null : valor.error}
      empty={filas.length === 0}
      emptyTitle="No hay stock valorizado"
      skeletonHeight={280}
      action={
        <Button component={Link} href="/inventario" size="small">
          Ver inventario
        </Button>
      }
    >
      <BarChart
        height={Math.max(160, filas.length * 34 + 60)}
        layout="horizontal"
        yAxis={[{ scaleType: 'band', data: filas.map((f) => f.producto_nombre), width: 130 }]}
        xAxis={[{ valueFormatter: (v: number) => formatUsdCorto(v) }]}
        series={[
          {
            data: filas.map((f) => f.valor_usd),
            label: 'Valor USD',
            color: c.usd,
            valueFormatter: (v, { dataIndex }) => {
              const f = filas[dataIndex]
              return `${formatUsd(v ?? 0)}${f ? ` · ${formatKg(f.stock_kg)}` : ''}`
            },
          },
        ]}
        hideLegend
        aria-label="Barras: valor del inventario en USD por producto"
      />
      <ChartLegendTable
        caption="Valor del inventario por producto"
        rows={filas}
        getRowKey={(f, i) => f.producto_id ?? `resto-${i}`}
        columns={[
          { key: 'producto', label: 'Producto', render: (f) => f.producto_nombre },
          { key: 'lotes', label: 'Lotes', align: 'right', render: (f) => formatEntero(f.lotes) },
          { key: 'kg', label: 'Stock', align: 'right', render: (f) => formatKg(f.stock_kg) },
          { key: 'usd', label: 'USD', align: 'right', render: (f) => formatUsd(f.valor_usd) },
          { key: 'bs', label: 'Bs', align: 'right', render: (f) => (f.valor_bs === null ? '—' : formatBs(f.valor_bs)) },
        ]}
      />
    </ChartCard>
  )
}
