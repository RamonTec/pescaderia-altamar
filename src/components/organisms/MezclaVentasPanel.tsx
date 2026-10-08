'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import type { BloqueDashboard, MezclaVentas, ParteMezcla } from '@/types/domain'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { ETIQUETA_CONDICION, ETIQUETA_METODO, ETIQUETA_MONEDA } from '@/lib/dashboard/etiquetas'
import { formatEntero, formatKg, formatPct, formatUsd, formatUsdCorto } from '@/lib/format'

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

function Barras<K extends string>({
  partes,
  etiquetas,
  colores,
  ariaLabel,
}: {
  partes: ParteMezcla<K>[]
  etiquetas: Record<K, string>
  colores: readonly string[]
  ariaLabel: string
}) {
  const nombres = partes.map((p) => etiquetas[p.clave] ?? p.clave)
  return (
    <BarChart
      height={Math.max(96, partes.length * 40 + 40)}
      layout="horizontal"
      yAxis={[
        {
          scaleType: 'band',
          data: nombres,
          width: 110,
          colorMap: { type: 'ordinal', values: nombres, colors: [...colores] },
        },
      ]}
      xAxis={[{ valueFormatter: (v: number) => formatUsdCorto(v) }]}
      series={[
        {
          data: partes.map((p) => p.usd),
          label: 'USD',
          valueFormatter: (v, { dataIndex }) => {
            const p = partes[dataIndex]
            return `${formatUsd(v ?? 0)}${p?.pct != null ? ` · ${formatPct(p.pct)}` : ''}`
          },
        },
      ]}
      hideLegend
      aria-label={ariaLabel}
    />
  )
}

/**
 * Mezcla de ventas (15, B9–B11): contado vs crédito (USD y % de las ventas
 * netas sin IVA), métodos y monedas de los cobros del período y ticket
 * promedio (ventas / facturas, sin IVA) con kg por factura.
 */
export function MezclaVentasPanel({ mezcla }: { mezcla: BloqueDashboard<MezclaVentas> }) {
  const theme = useTheme()
  const c = coloresGrafico(theme)
  const m = mezcla.ok ? mezcla.data : null

  return (
    <ChartCard
      title="Mezcla de ventas y cobros"
      help="Ventas sin IVA por condición; cobros del período por método y moneda."
      error={mezcla.ok ? null : mezcla.error}
      empty={m !== null && m.facturas === 0 && m.metodos.length === 0}
      emptyTitle="Sin ventas ni cobros en el período"
      skeletonHeight={320}
    >
      {m ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5 }}>
            <Cifra titulo="Ticket promedio" valor={m.ticket_promedio_usd === null ? '—' : formatUsd(m.ticket_promedio_usd)} />
            <Cifra titulo="Kg por factura" valor={m.kg_por_factura === null ? '—' : formatKg(m.kg_por_factura)} />
            <Cifra titulo="Facturas" valor={formatEntero(m.facturas)} />
          </Box>

          <Box>
            <Typography variant="subtitle1" component="h4">
              Contado vs crédito
            </Typography>
            <Barras
              partes={m.condicion}
              etiquetas={ETIQUETA_CONDICION}
              colores={[c.usd, c.info]}
              ariaLabel="Barras: ventas de contado y a crédito en USD"
            />
          </Box>

          <Box>
            <Typography variant="subtitle1" component="h4">
              Cobros por método
            </Typography>
            {m.metodos.length > 0 ? (
              <>
                <Barras
                  partes={m.metodos}
                  etiquetas={ETIQUETA_METODO}
                  colores={c.categorias}
                  ariaLabel="Barras: cobros del período por método de pago en USD"
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  Por moneda:{' '}
                  {m.monedas
                    .map((p) => `${ETIQUETA_MONEDA[p.clave]} ${formatUsd(p.usd)}${p.pct !== null ? ` (${formatPct(p.pct)})` : ''}`)
                    .join(' · ')}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Sin cobros en el período.
              </Typography>
            )}
          </Box>

          <ChartLegendTable
            caption="Mezcla de ventas y cobros"
            rows={[
              ...m.condicion.map((p) => ({ grupo: 'Ventas', nombre: ETIQUETA_CONDICION[p.clave], ...p })),
              ...m.metodos.map((p) => ({ grupo: 'Cobros', nombre: ETIQUETA_METODO[p.clave] ?? p.clave, ...p })),
              ...m.monedas.map((p) => ({ grupo: 'Cobros por moneda', nombre: ETIQUETA_MONEDA[p.clave] ?? p.clave, ...p })),
            ]}
            getRowKey={(r, i) => `${r.grupo}-${r.clave}-${i}`}
            columns={[
              { key: 'grupo', label: 'Grupo', render: (r) => r.grupo },
              { key: 'nombre', label: 'Concepto', render: (r) => r.nombre },
              { key: 'usd', label: 'USD', align: 'right', render: (r) => formatUsd(r.usd) },
              { key: 'pct', label: '%', align: 'right', render: (r) => (r.pct === null ? '—' : formatPct(r.pct)) },
              { key: 'n', label: 'Cantidad', align: 'right', render: (r) => formatEntero(r.cantidad) },
            ]}
          />
        </Box>
      ) : null}
    </ChartCard>
  )
}
