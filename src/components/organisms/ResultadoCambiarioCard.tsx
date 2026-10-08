'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { ChartCard } from '@/components/molecules/ChartCard'
import type { BloqueDashboard, ResultadoCambiario } from '@/types/domain'
import { formatBs, formatEntero } from '@/lib/format'

function Fila({ titulo, detalle, valor, fuerte = false }: { titulo: string; detalle?: string; valor: number; fuerte?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant={fuerte ? 'subtitle1' : 'body2'} component="p">
          {titulo}
        </Typography>
        {detalle ? (
          <Typography variant="caption" color="text.secondary" component="p">
            {detalle}
          </Typography>
        ) : null}
      </Box>
      <Typography
        variant={fuerte ? 'h5' : 'body1'}
        component="p"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          color: fuerte ? (valor < 0 ? 'error.main' : valor > 0 ? 'success.main' : 'text.primary') : 'text.primary',
        }}
      >
        {formatBs(valor)}
      </Typography>
    </Box>
  )
}

/**
 * Resultado cambiario del período (15, B4/D5), en Bs y **separado** del
 * margen bruto USD: ganancia cambiaria de los cobros, de los pagos a
 * proveedores (positivo = mayor desembolso en Bs) y el neto = cobros − pagos.
 */
export function ResultadoCambiarioCard({ resultado }: { resultado: BloqueDashboard<ResultadoCambiario> }) {
  const r = resultado.ok ? resultado.data : null
  return (
    <ChartCard
      title="Resultado cambiario (Bs)"
      help="Diferencia por tasa entre la factura (o la compra) y el día del pago. Va en Bs y no se suma al margen USD."
      error={resultado.ok ? null : resultado.error}
      empty={r !== null && r.cobros === 0 && r.pagos_proveedores === 0}
      emptyTitle="Sin cobros ni pagos a proveedores en el período"
      skeletonHeight={160}
    >
      {r ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Fila
            titulo="Cobros a clientes"
            detalle={`${formatEntero(r.cobros)} ${r.cobros === 1 ? 'cobro' : 'cobros'}`}
            valor={r.cobros_bs}
          />
          <Fila
            titulo="Pagos a proveedores"
            detalle={`${formatEntero(r.pagos_proveedores)} ${r.pagos_proveedores === 1 ? 'pago' : 'pagos'} · positivo = se pagaron más Bs`}
            valor={r.pagos_proveedores_bs}
          />
          <Divider />
          <Fila titulo="Resultado cambiario neto (Bs)" detalle="Cobros − pagos a proveedores" valor={r.neto_bs} fuerte />
        </Box>
      ) : null}
    </ChartCard>
  )
}
