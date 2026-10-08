'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { useTheme } from '@mui/material/styles'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import { BarLineChart } from './BarLineChart'
import type { BloqueDashboard, GranularidadSpread, PuntoSpread } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { etiquetaDia, etiquetaMes } from '@/lib/dashboard/etiquetas'
import { formatKg, formatUsd } from '@/lib/format'

export interface SpreadPrecioCostoChartProps {
  spread: BloqueDashboard<PuntoSpread[]>
  granularidad: GranularidadSpread
  /** Producto filtrado (`?producto=`); `null` = todos. */
  productoId: string | null
  /** Productos para el filtro (los que tuvieron salida en el período). */
  productos: { id: string; nombre: string }[]
}

const TODOS = '__todos'

/**
 * Spread precio vs costo por kg (15, B5): precio y costo medios ponderados
 * por kg (líneas) y su diferencia (barras), por semana ISO o por mes si el
 * rango supera 120 días. Filtro por producto en `?producto=`.
 */
export function SpreadPrecioCostoChart({ spread, granularidad, productoId, productos }: SpreadPrecioCostoChartProps) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  const puntos = spread.ok ? spread.data : []
  const etiqueta = (p: PuntoSpread) =>
    granularidad === 'semana' ? `Sem. ${etiquetaDia(p.periodo)}` : etiquetaMes(p.periodo)

  const filtrar = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (id === TODOS) params.delete('producto')
    else params.set('producto', id)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const productoActual = productoId && productos.some((p) => p.id === productoId) ? productoId : TODOS

  return (
    <ChartCard
      title="Precio vs costo por kg"
      help={`Medias ponderadas por kg vendidos, por ${granularidad === 'semana' ? 'semana' : 'mes'}. El spread es lo que queda por kg.`}
      error={spread.ok ? null : spread.error}
      empty={puntos.every((p) => p.kg === 0)}
      emptyTitle="Sin ventas para comparar en el período"
      skeletonHeight={300}
      action={
        productos.length > 0 ? (
          <TextField
            select
            size="small"
            label="Producto"
            value={productoActual}
            onChange={(e) => filtrar(e.target.value)}
            disabled={pending}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value={TODOS}>Todos los productos</MenuItem>
            {productos.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.nombre}
              </MenuItem>
            ))}
          </TextField>
        ) : null
      }
    >
      <BarLineChart
        categorias={puntos.map(etiqueta)}
        barras={[
          {
            id: 'spread',
            label: 'Spread/kg',
            data: puntos.map((p) => p.spread_usd_kg),
            color: c.positivo,
            format: formatUsd,
          },
        ]}
        lineas={[
          { id: 'precio', label: 'Precio/kg', data: puntos.map((p) => p.precio_medio_usd_kg), color: c.usd, format: formatUsd },
          { id: 'costo', label: 'Costo/kg', data: puntos.map((p) => p.costo_medio_usd_kg), color: c.costo, format: formatUsd },
        ]}
        formatoEjeIzq={formatUsd}
        ariaLabel="Gráfico de líneas y barras: precio y costo medio por kg y su diferencia"
      />
      <ChartLegendTable
        caption="Precio y costo medio por kg"
        rows={puntos}
        getRowKey={(p) => p.periodo}
        columns={[
          { key: 'periodo', label: granularidad === 'semana' ? 'Semana' : 'Mes', render: etiqueta },
          { key: 'kg', label: 'Kilos', align: 'right', render: (p) => formatKg(p.kg) },
          { key: 'precio', label: 'Precio/kg', align: 'right', render: (p) => (p.precio_medio_usd_kg === null ? '—' : formatUsd(p.precio_medio_usd_kg)) },
          { key: 'costo', label: 'Costo/kg', align: 'right', render: (p) => (p.costo_medio_usd_kg === null ? '—' : formatUsd(p.costo_medio_usd_kg)) },
          { key: 'spread', label: 'Spread/kg', align: 'right', render: (p) => (p.spread_usd_kg === null ? '—' : formatUsd(p.spread_usd_kg)) },
        ]}
      />
    </ChartCard>
  )
}
