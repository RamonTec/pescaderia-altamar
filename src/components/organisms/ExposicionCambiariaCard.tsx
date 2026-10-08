'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { ChartCard } from '@/components/molecules/ChartCard'
import type { BloqueDashboard, ExposicionCambiaria } from '@/types/domain'
import { formatBs, formatFecha, formatPct, formatTasa, formatUsd } from '@/lib/format'

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {titulo}
      </Typography>
      <Typography variant="h6" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
      {detalle ? (
        <Typography variant="caption" color="text.secondary" component="p">
          {detalle}
        </Typography>
      ) : null}
    </Box>
  )
}

/**
 * Exposición cambiaria (15, C4/D7), informativa y en Bs: saldo CxC en USD,
 * tasas vigentes BCV y paralela, brecha (% y Bs sobre el saldo) y resultado
 * latente del saldo respecto de la tasa congelada en cada factura.
 */
export function ExposicionCambiariaCard({ exposicion }: { exposicion: BloqueDashboard<ExposicionCambiaria> }) {
  const e = exposicion.ok ? exposicion.data : null
  return (
    <ChartCard
      title="Exposición cambiaria"
      help="Informativo. La deuda está en USD; esto estima su efecto en Bs a las tasas de hoy."
      error={exposicion.ok ? null : exposicion.error}
      skeletonHeight={220}
    >
      {e ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5 }}>
            <Dato titulo="Saldo por cobrar" valor={formatUsd(e.saldo_usd)} />
            <Dato
              titulo="BCV"
              valor={e.tasa_bcv === null ? '—' : formatTasa(e.tasa_bcv)}
              detalle={e.tasa_bcv_fecha ? `valor ${formatFecha(e.tasa_bcv_fecha)}` : 'sin tasa'}
            />
            <Dato
              titulo="Paralela"
              valor={e.tasa_paralela === null ? '—' : formatTasa(e.tasa_paralela)}
              detalle={e.tasa_paralela_fecha ? `valor ${formatFecha(e.tasa_paralela_fecha)}` : 'sin tasa'}
            />
          </Box>
          <Divider />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
            <Dato
              titulo="Brecha BCV / paralela"
              valor={e.brecha_bs === null ? '—' : formatBs(e.brecha_bs)}
              detalle={e.brecha_pct === null ? 'Falta una de las tasas' : `${formatPct(e.brecha_pct)} sobre el saldo`}
            />
            <Dato
              titulo="Resultado latente"
              valor={e.latente_bs === null ? '—' : formatBs(e.latente_bs)}
              detalle={`Saldo × (tasa ${e.fuente === 'paralela' ? 'paralela' : 'BCV'} de hoy − tasa de cada factura)`}
            />
          </Box>
        </Box>
      ) : null}
    </ChartCard>
  )
}
