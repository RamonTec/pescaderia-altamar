'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import { BarLineChart } from './BarLineChart'
import type { BloqueDashboard, VentaMensual } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { etiquetaMes } from '@/lib/dashboard/etiquetas'
import { formatEntero, formatKg, formatKgCorto, formatUsd, formatUsdCorto } from '@/lib/format'

/**
 * Ventas por mes (15, B1): USD sin IVA en barras (eje izquierdo) y kg en
 * línea (eje derecho), netos de notas de crédito. Siempre los 12 meses que
 * terminan en el mes de `hasta` (D6). En `xs` una sola serie con tabs USD/kg.
 */
export function VentasMensualesChart({ ventas }: { ventas: BloqueDashboard<VentaMensual[]> }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const movil = useMediaQuery(theme.breakpoints.down('sm'))
  const [serie, setSerie] = React.useState<'usd' | 'kg'>('usd')
  const meses = ventas.ok ? ventas.data : []
  const categorias = meses.map((m) => etiquetaMes(m.mes))

  const usd = {
    id: 'usd',
    label: 'Ventas USD',
    data: meses.map((m) => m.ventas_usd),
    color: c.usd,
    format: formatUsd,
  }
  const kg = {
    id: 'kg',
    label: 'Kilos',
    data: meses.map((m) => m.kg),
    color: c.kg,
    format: formatKg,
    eje: 'der' as const,
  }

  return (
    <ChartCard
      title="Ventas por mes"
      help="Últimos 12 meses hasta el mes final del período. USD sin IVA y kg, netos de notas de crédito."
      error={ventas.ok ? null : ventas.error}
      empty={meses.every((m) => m.ventas_usd === 0 && m.kg === 0)}
      emptyTitle="Sin ventas en los últimos 12 meses"
      skeletonHeight={300}
    >
      {movil ? (
        <Box>
          <Tabs
            value={serie}
            onChange={(_, v: 'usd' | 'kg') => setSerie(v)}
            aria-label="Serie a mostrar"
            variant="fullWidth"
          >
            <Tab value="usd" label="USD" />
            <Tab value="kg" label="Kilos" />
          </Tabs>
          {serie === 'usd' ? (
            <BarLineChart
              categorias={categorias}
              barras={[usd]}
              formatoEjeIzq={formatUsdCorto}
              ariaLabel="Gráfico de barras: ventas en USD por mes"
            />
          ) : (
            <BarLineChart
              categorias={categorias}
              lineas={[{ ...kg, eje: 'izq' }]}
              formatoEjeIzq={formatKgCorto}
              ariaLabel="Gráfico de línea: kilos vendidos por mes"
            />
          )}
        </Box>
      ) : (
        <BarLineChart
          categorias={categorias}
          barras={[usd]}
          lineas={[kg]}
          formatoEjeIzq={formatUsdCorto}
          formatoEjeDer={formatKgCorto}
          ariaLabel="Gráfico de barras y línea: ventas en USD (eje izquierdo) y kilos (eje derecho) por mes"
        />
      )}
      <ChartLegendTable
        caption="Ventas por mes"
        rows={meses}
        getRowKey={(m) => m.mes}
        columns={[
          { key: 'mes', label: 'Mes', render: (m) => etiquetaMes(m.mes) },
          { key: 'usd', label: 'Ventas', align: 'right', render: (m) => formatUsd(m.ventas_usd) },
          { key: 'kg', label: 'Kilos', align: 'right', render: (m) => formatKg(m.kg) },
          { key: 'n', label: 'Facturas', align: 'right', render: (m) => formatEntero(m.facturas) },
        ]}
      />
    </ChartCard>
  )
}
