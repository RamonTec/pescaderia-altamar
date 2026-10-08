'use client'

import * as React from 'react'
import { ChartsDataProvider } from '@mui/x-charts/ChartsDataProvider'
import { ChartsWrapper } from '@mui/x-charts/ChartsWrapper'
import { ChartsLegend } from '@mui/x-charts/ChartsLegend'
import { ChartsSurface } from '@mui/x-charts/ChartsSurface'
import { ChartsGrid } from '@mui/x-charts/ChartsGrid'
import { ChartsAxis } from '@mui/x-charts/ChartsAxis'
import { ChartsAxisHighlight } from '@mui/x-charts/ChartsAxisHighlight'
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip'
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine'
import { BarPlot } from '@mui/x-charts/BarChart'
import { LinePlot, MarkPlot } from '@mui/x-charts/LineChart'
import type { AllSeriesType } from '@mui/x-charts/models'

export interface SerieBarLine {
  id: string
  label: string
  data: (number | null)[]
  color: string
  /** Formato del valor en el tooltip (`lib/format.ts`). */
  format: (n: number) => string
  /** Eje de valores: izquierdo (por defecto) o derecho. */
  eje?: 'izq' | 'der'
}

export interface BarLineChartProps {
  /** Etiquetas del eje X (meses, días, semanas). */
  categorias: string[]
  barras?: SerieBarLine[]
  lineas?: SerieBarLine[]
  /** Formato de las marcas del eje izquierdo. */
  formatoEjeIzq: (n: number) => string
  /** Si se da, hay eje derecho (eje doble). */
  formatoEjeDer?: (n: number) => string
  /** Dominio fijo del eje derecho (p. ej. 0–1 para porcentajes). */
  rangoEjeDer?: { min: number; max: number }
  height?: number
  /** Línea horizontal de referencia (p. ej. el 80 % del Pareto). */
  referencia?: { valor: number; etiqueta: string; eje?: 'izq' | 'der'; color: string }
  /** Descripción del gráfico para lectores de pantalla. */
  ariaLabel: string
}

/**
 * Barras + líneas sobre un mismo eje X de categorías, con eje doble opcional
 * (15-dashboard: ventas USD/kg por mes, flujo de caja con acumulado). Basado
 * en la composición de `@mui/x-charts` (`ChartsDataProvider` + `BarPlot` +
 * `LinePlot`), con leyenda arriba, tooltip por eje y animaciones del paquete
 * (respetan `prefers-reduced-motion`). Los colores llegan del theme.
 */
export function BarLineChart({
  categorias,
  barras = [],
  lineas = [],
  formatoEjeIzq,
  formatoEjeDer,
  rangoEjeDer,
  height = 280,
  referencia,
  ariaLabel,
}: BarLineChartProps) {
  const series: AllSeriesType[] = [
    ...barras.map(
      (s): AllSeriesType => ({
        type: 'bar',
        id: s.id,
        label: s.label,
        data: s.data,
        color: s.color,
        yAxisId: s.eje === 'der' ? 'der' : 'izq',
        valueFormatter: (v) => (v === null ? '—' : s.format(v)),
      })
    ),
    ...lineas.map(
      (s): AllSeriesType => ({
        type: 'line',
        id: s.id,
        label: s.label,
        data: s.data,
        color: s.color,
        yAxisId: s.eje === 'der' ? 'der' : 'izq',
        valueFormatter: (v) => (v === null ? '—' : s.format(v)),
        showMark: categorias.length <= 31,
      })
    ),
  ]

  return (
    <ChartsDataProvider
      height={height}
      series={series}
      xAxis={[{ id: 'x', scaleType: 'band', data: categorias }]}
      yAxis={[
        { id: 'izq', position: 'left', valueFormatter: (v: number) => formatoEjeIzq(v), width: 64 },
        ...(formatoEjeDer
          ? [
              {
                id: 'der',
                position: 'right' as const,
                valueFormatter: (v: number) => formatoEjeDer(v),
                width: 72,
                ...(rangoEjeDer ?? {}),
              },
            ]
          : []),
      ]}
    >
      <ChartsWrapper legendPosition={{ vertical: 'top', horizontal: 'start' }}>
        <ChartsLegend />
        <ChartsSurface aria-label={ariaLabel} role="img">
          <ChartsGrid horizontal />
          <BarPlot />
          <LinePlot />
          <MarkPlot />
          {referencia ? (
            <ChartsReferenceLine
              y={referencia.valor}
              axisId={referencia.eje === 'der' ? 'der' : 'izq'}
              label={referencia.etiqueta}
              labelAlign="end"
              lineStyle={{ stroke: referencia.color, strokeDasharray: '4 4' }}
              labelStyle={{ fill: referencia.color, fontSize: 12 }}
            />
          ) : null}
          <ChartsAxisHighlight x="band" />
          <ChartsAxis />
        </ChartsSurface>
        <ChartsTooltip trigger="axis" />
      </ChartsWrapper>
    </ChartsDataProvider>
  )
}
