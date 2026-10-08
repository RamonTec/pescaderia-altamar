'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import { BarLineChart } from './BarLineChart'
import type { BloqueDashboard, DiasFlujo, FlujoProyectado } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { etiquetaDia } from '@/lib/dashboard/etiquetas'
import { formatFecha, formatUsd, formatUsdCorto } from '@/lib/format'

/**
 * Flujo de caja proyectado (15, C3): por día de los próximos 7 o 30 días,
 * cobros esperados (facturas que vencen) y pagos esperados (compras a crédito
 * con el vencimiento derivado de D2), con el neto acumulado. Lo ya vencido va
 * aparte. El toggle escribe `?flujo=7|30`.
 */
export function FlujoCajaChart({ flujo, dias }: { flujo: BloqueDashboard<FlujoProyectado>; dias: DiasFlujo }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()
  const f = flujo.ok ? flujo.data : null
  const serie = f?.serie ?? []

  const cambiar = (v: DiasFlujo | null) => {
    if (!v || v === dias) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('flujo', String(v))
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return (
    <ChartCard
      title="Flujo de caja proyectado"
      help="Cobros y pagos que vencen cada día (USD) y el neto acumulado. Lo vencido no se reparte en días."
      error={flujo.ok ? null : flujo.error}
      skeletonHeight={320}
      action={
        <ToggleButtonGroup
          size="small"
          exclusive
          value={dias}
          onChange={(_, v: DiasFlujo | null) => cambiar(v)}
          aria-label="Días a proyectar"
          disabled={pending}
        >
          <ToggleButton value={7}>7 días</ToggleButton>
          <ToggleButton value={30}>30 días</ToggleButton>
        </ToggleButtonGroup>
      }
    >
      {f ? (
        <Box sx={{ display: 'grid', gap: 1.5, opacity: pending ? 0.6 : 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" component="p">
                Vencido sin cobrar
              </Typography>
              <Typography variant="h6" component="p" sx={{ fontVariantNumeric: 'tabular-nums', color: f.vencido_cobros_usd > 0.005 ? 'error.main' : 'text.primary' }}>
                {formatUsd(f.vencido_cobros_usd)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" component="p">
                Vencido sin pagar
              </Typography>
              <Typography variant="h6" component="p" sx={{ fontVariantNumeric: 'tabular-nums', color: f.vencido_pagos_usd > 0.005 ? 'error.main' : 'text.primary' }}>
                {formatUsd(f.vencido_pagos_usd)}
              </Typography>
            </Box>
          </Box>
          <BarLineChart
            categorias={serie.map((d) => etiquetaDia(d.fecha))}
            barras={[
              { id: 'cobros', label: 'Cobros', data: serie.map((d) => d.cobros_usd), color: c.positivo, format: formatUsd },
              { id: 'pagos', label: 'Pagos', data: serie.map((d) => d.pagos_usd), color: c.negativo, format: formatUsd },
            ]}
            lineas={[
              { id: 'acumulado', label: 'Neto acumulado', data: serie.map((d) => d.acumulado_usd), color: c.usd, format: formatUsd },
            ]}
            formatoEjeIzq={formatUsdCorto}
            ariaLabel={`Gráfico de barras y línea: cobros, pagos y neto acumulado de los próximos ${dias} días`}
          />
          <ChartLegendTable
            caption={`Flujo proyectado a ${dias} días`}
            rows={serie}
            getRowKey={(d) => d.fecha}
            columns={[
              { key: 'fecha', label: 'Fecha', render: (d) => formatFecha(d.fecha) },
              { key: 'cobros', label: 'Cobros', align: 'right', render: (d) => formatUsd(d.cobros_usd) },
              { key: 'pagos', label: 'Pagos', align: 'right', render: (d) => formatUsd(d.pagos_usd) },
              { key: 'neto', label: 'Neto', align: 'right', render: (d) => formatUsd(d.neto_usd) },
              { key: 'acum', label: 'Acumulado', align: 'right', render: (d) => formatUsd(d.acumulado_usd) },
            ]}
          />
        </Box>
      ) : null}
    </ChartCard>
  )
}
