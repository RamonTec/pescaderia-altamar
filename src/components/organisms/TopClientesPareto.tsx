'use client'

import * as React from 'react'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import { BarLineChart } from './BarLineChart'
import type { BloqueDashboard, TopClientesPareto as Pareto } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { CORTE_PARETO } from '@/lib/dashboard/series'
import { formatEntero, formatPct, formatUsd, formatUsdCorto } from '@/lib/format'

/** Nombre corto para el eje X. */
const corto = (s: string) => (s.length > 14 ? `${s.slice(0, 13)}…` : s)

/**
 * Mejores clientes del período (15, B12): ventas netas sin IVA (barras),
 * % acumulado (línea, eje derecho) y el corte del 80 %. Top 10 + "Resto".
 */
export function TopClientesPareto({ top }: { top: BloqueDashboard<Pareto> }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const p = top.ok ? top.data : null
  const clientes = p?.clientes ?? []
  const corte = p?.indice_corte_80 ?? null

  return (
    <ChartCard
      title="Mejores clientes (Pareto)"
      help={
        p && corte !== null
          ? `${formatEntero(corte + 1)} de ${formatEntero(p.clientes_periodo)} clientes suman el 80 % de las ventas (${formatUsd(p.total_usd)}).`
          : 'Ventas del período por cliente, sin IVA y netas de notas de crédito.'
      }
      error={top.ok ? null : top.error}
      empty={clientes.length === 0}
      emptyTitle="Sin ventas en el período"
      skeletonHeight={300}
    >
      <BarLineChart
        categorias={clientes.map((x) => corto(x.cliente_nombre))}
        barras={[
          { id: 'ventas', label: 'Ventas', data: clientes.map((x) => x.ventas_usd), color: c.usd, format: formatUsd },
        ]}
        lineas={[
          {
            id: 'acumulado',
            label: '% acumulado',
            data: clientes.map((x) => x.pct_acumulado),
            color: c.costo,
            format: formatPct,
            eje: 'der',
          },
        ]}
        formatoEjeIzq={formatUsdCorto}
        formatoEjeDer={(v) => formatPct(v)}
        rangoEjeDer={{ min: 0, max: 1 }}
        referencia={{ valor: CORTE_PARETO, etiqueta: '80 %', eje: 'der', color: c.neutro }}
        ariaLabel="Gráfico de Pareto: ventas por cliente y porcentaje acumulado con el corte del 80 %"
      />
      <ChartLegendTable
        caption="Mejores clientes del período"
        rows={clientes}
        getRowKey={(x, i) => x.cliente_id ?? `resto-${i}`}
        columns={[
          {
            key: 'cliente',
            label: 'Cliente',
            render: (x) => (
              <Typography variant="body2" component="span" sx={{ fontWeight: x.dentro_80 ? 600 : 400 }}>
                {x.cliente_nombre}
              </Typography>
            ),
          },
          { key: 'ventas', label: 'Ventas', align: 'right', render: (x) => formatUsd(x.ventas_usd) },
          { key: 'pct', label: '%', align: 'right', render: (x) => formatPct(x.pct) },
          { key: 'acum', label: '% acumulado', align: 'right', render: (x) => formatPct(x.pct_acumulado) },
          { key: 'n', label: 'Facturas', align: 'right', render: (x) => (x.facturas === null ? '—' : formatEntero(x.facturas)) },
        ]}
      />
    </ChartCard>
  )
}
