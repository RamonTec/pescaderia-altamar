'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import type { BloqueDashboard, MermaProceso } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { formatEntero, formatKg, formatKgCorto, formatPct, formatUsd } from '@/lib/format'

function Cifra({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {titulo}
      </Typography>
      <Typography variant="h6" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
    </Box>
  )
}

/**
 * Merma por procesos (15, B6, §4.3): por producto de origen, kg de entrada y
 * salida, merma (kg y %), rendimiento = salida / entrada y costo de la merma
 * al costo del lote origen. Barras apiladas salida + merma por producto.
 */
export function MermaProcesosPanel({ merma }: { merma: BloqueDashboard<MermaProceso[]> }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const filas = merma.ok ? merma.data : []
  const t = filas.reduce(
    (a, f) => ({
      entrada: a.entrada + f.kg_entrada,
      salida: a.salida + f.kg_salida,
      merma: a.merma + f.merma_kg,
      costo: a.costo + f.costo_merma_usd,
    }),
    { entrada: 0, salida: 0, merma: 0, costo: 0 }
  )

  return (
    <ChartCard
      title="Merma por procesos"
      help="Procesamientos del período por producto de origen. El costo de la merma se calcula al costo del lote que entró."
      error={merma.ok ? null : merma.error}
      empty={filas.length === 0}
      emptyTitle="Sin procesamientos en el período"
      skeletonHeight={300}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
        <Cifra titulo="Entrada" valor={formatKg(t.entrada)} />
        <Cifra titulo="Merma" valor={formatKg(t.merma)} />
        <Cifra titulo="Rendimiento" valor={t.entrada > 0 ? formatPct(t.salida / t.entrada) : '—'} />
        <Cifra titulo="Costo de la merma" valor={formatUsd(t.costo)} />
      </Box>
      <BarChart
        height={Math.max(160, filas.length * 44 + 60)}
        layout="horizontal"
        yAxis={[{ scaleType: 'band', data: filas.map((f) => f.producto_nombre), width: 130 }]}
        xAxis={[{ valueFormatter: (v: number) => formatKgCorto(v) }]}
        series={[
          {
            data: filas.map((f) => f.kg_salida),
            label: 'Salida',
            stack: 'kg',
            color: c.positivo,
            valueFormatter: (v, { dataIndex }) => {
              const f = filas[dataIndex]
              return `${formatKg(v ?? 0)}${f?.rendimiento != null ? ` · rendimiento ${formatPct(f.rendimiento)}` : ''}`
            },
          },
          {
            data: filas.map((f) => f.merma_kg),
            label: 'Merma',
            stack: 'kg',
            color: c.negativo,
            valueFormatter: (v, { dataIndex }) => {
              const f = filas[dataIndex]
              return `${formatKg(v ?? 0)}${f?.merma_pct != null ? ` · ${formatPct(f.merma_pct)}` : ''}`
            },
          },
        ]}
        slotProps={{ legend: { position: { vertical: 'top', horizontal: 'start' } } }}
        aria-label="Barras apiladas: kilos de salida y de merma por producto de origen"
      />
      <ChartLegendTable
        caption="Merma por producto de origen"
        rows={filas}
        getRowKey={(f) => f.producto_id}
        columns={[
          { key: 'producto', label: 'Producto', render: (f) => f.producto_nombre },
          { key: 'procesos', label: 'Procesos', align: 'right', render: (f) => formatEntero(f.procesos) },
          { key: 'entrada', label: 'Entrada', align: 'right', render: (f) => formatKg(f.kg_entrada) },
          { key: 'salida', label: 'Salida', align: 'right', render: (f) => formatKg(f.kg_salida) },
          { key: 'merma', label: 'Merma', align: 'right', render: (f) => formatKg(f.merma_kg) },
          { key: 'pct', label: 'Merma %', align: 'right', render: (f) => (f.merma_pct === null ? '—' : formatPct(f.merma_pct)) },
          { key: 'rend', label: 'Rendimiento', align: 'right', render: (f) => (f.rendimiento === null ? '—' : formatPct(f.rendimiento)) },
          { key: 'costo', label: 'Costo merma', align: 'right', render: (f) => formatUsd(f.costo_merma_usd) },
        ]}
      />
    </ChartCard>
  )
}
