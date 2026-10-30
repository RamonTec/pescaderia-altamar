'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import { KpiCard } from '@/components/molecules/KpiCard'
import { ListaResumen } from '@/components/molecules/ListaResumen'
import { RangoFechasSelector } from '@/components/molecules/RangoFechasSelector'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { rangoDesdePreset } from '@/lib/dashboard/rangos'
import { fechaHoy, formatKg, formatUsd } from '@/lib/format'
import { Apartado, Demos, Seccion } from './comun'

const VENTAS_DEMO = [
  { mes: 'May', usd: 4200, kg: 610 },
  { mes: 'Jun', usd: 5100, kg: 702 },
  { mes: 'Jul', usd: 4800, kg: 655 },
  { mes: 'Ago', usd: 6300, kg: 880 },
  { mes: 'Sep', usd: 5900, kg: 812 },
  { mes: 'Oct', usd: 2100, kg: 290 },
]

/** Molecules del dashboard (15) y una gráfica de `@mui/x-charts` con los colores del theme. */
export function Dashboard() {
  const theme = useTheme()
  const colores = coloresGrafico(theme)
  const hoy = fechaHoy()
  return (
    <Seccion
      id="dashboard"
      titulo="Dashboard"
      descripcion="KpiCard (subtitle2, cifra h5 tabular, tono con ícono), ChartCard con sus estados, ChartLegendTable como alternativa accesible, ListaResumen y RangoFechasSelector. Colores de las gráficas solo desde theme.palette."
    >
      <RangoFechasSelector rango={rangoDesdePreset('mes_en_curso', hoy)} hoy={hoy} />
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        <KpiCard title="Ventas del día" value={formatUsd(1280.5)} secondary={`${formatKg(212.4)} · 6 facturas`} />
        <KpiCard title="CxC vencida" value={formatUsd(840)} secondary="3 clientes con vencidas" tone="error" href="/cobros" />
        <KpiCard title="Stock bajo" value="2 productos" secondary="Umbral 20,000 kg" tone="warning" />
        <KpiCard title="Cargando" loading />
      </Box>
      <Demos>
        <ChartCard title="Ventas por mes" help="Barras con los colores del theme; revisa claro y oscuro.">
          <BarChart
            height={240}
            dataset={VENTAS_DEMO}
            xAxis={[{ scaleType: 'band', dataKey: 'mes' }]}
            yAxis={[{ valueFormatter: (v: number) => formatUsd(v), width: 72 }]}
            series={[
              { dataKey: 'usd', label: 'Ventas USD', color: colores.usd, valueFormatter: (v) => formatUsd(v ?? 0) },
              { dataKey: 'kg', label: 'Kilos', color: colores.kg, valueFormatter: (v) => formatKg(v ?? 0) },
            ]}
            aria-label="Gráfica de prueba: ventas por mes en USD y kilos"
          />
          <ChartLegendTable
            caption="Ventas por mes"
            rows={VENTAS_DEMO}
            getRowKey={(r) => r.mes}
            columns={[
              { key: 'mes', label: 'Mes', render: (r) => r.mes },
              { key: 'usd', label: 'Ventas', align: 'right', render: (r) => formatUsd(r.usd) },
              { key: 'kg', label: 'Kilos', align: 'right', render: (r) => formatKg(r.kg) },
            ]}
          />
        </ChartCard>
        <Box sx={{ display: 'grid', gap: 2, alignContent: 'start' }}>
          <ChartCard title="Principales deudores">
            <ListaResumen
              ariaLabel="Principales deudores de muestra"
              filas={[
                { id: '1', primary: 'Restaurante El Muelle', secondary: 'Vencida hace 9 días', amount: formatUsd(840) },
                { id: '2', primary: 'Hotel Bahía Azul', secondary: 'Vence en 3 días', amount: formatUsd(520.5) },
              ]}
            />
          </ChartCard>
          <ChartCard title="Sin datos" empty emptyDescription="Fallback compacto dentro de la tarjeta." />
          <ChartCard title="Con error" error="No se pudo cargar la merma por procesos." />
        </Box>
      </Demos>
      <Apartado titulo="Paleta categórica (palette.chart)">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {colores.categorias.map((c, i) => (
            <Box key={c} title={`Serie ${i + 1}`} sx={{ width: 40, height: 24, borderRadius: '4px', bgcolor: c }} />
          ))}
        </Box>
      </Apartado>
    </Seccion>
  )
}
