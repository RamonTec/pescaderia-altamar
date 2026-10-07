'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { formatUsd } from '@/lib/format'

export interface CreditoResumenProps {
  limiteUsd: number | null
  /** `null` mientras no exista el módulo de ventas/cobros. */
  saldoUsd: number | null
}

const NUM = { fontVariantNumeric: 'tabular-nums' }

/**
 * Bloque de crédito de un cliente: el dato que se consulta en el mostrador
 * antes de fiar. Es el único bloque "casco" (fondo `brand.hull`) de la ficha.
 */
export function CreditoResumen({ limiteUsd, saldoUsd }: CreditoResumenProps) {
  const tieneCredito = limiteUsd != null && limiteUsd > 0
  const uso = tieneCredito && saldoUsd != null ? Math.min(saldoUsd / limiteUsd, 1) : null
  const disponible = tieneCredito && saldoUsd != null ? Math.max(limiteUsd - saldoUsd, 0) : null
  const barColor = uso != null && uso >= 1 ? 'brand.red' : 'brand.ochre'

  return (
    <Box
      component="section"
      aria-labelledby="credito-titulo"
      sx={{
        bgcolor: 'brand.hull',
        color: 'brand.onHull',
        borderRadius: 1,
        p: { xs: 2, sm: 3 },
        display: 'grid',
        gap: 2,
        alignContent: 'start',
      }}
    >
      <Typography id="credito-titulo" variant="h6" component="h2">
        Crédito
      </Typography>

      {tieneCredito ? (
        <>
          <Box>
            <Typography variant="body2" sx={{ color: 'brand.onHullMuted' }}>
              {disponible != null ? 'Disponible' : 'Límite'}
            </Typography>
            <Typography sx={{ ...NUM, fontSize: { xs: '1.75rem', sm: '2.125rem' }, lineHeight: 1.15 }}>
              {formatUsd(disponible ?? limiteUsd)}
            </Typography>
          </Box>

          <Box
            role={uso != null ? 'meter' : undefined}
            aria-label={uso != null ? 'Uso del crédito' : undefined}
            aria-valuemin={uso != null ? 0 : undefined}
            aria-valuemax={uso != null ? 100 : undefined}
            aria-valuenow={uso != null ? Math.round(uso * 100) : undefined}
            sx={{ height: 6, bgcolor: 'brand.hullDeep', borderRadius: 0.5, overflow: 'hidden' }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${(uso ?? 0) * 100}%`,
                bgcolor: barColor,
                transition: (t) => t.transitions.create('width'),
              }}
            />
          </Box>

          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              rowGap: 0.75,
              '& dt': { typography: 'body2', color: 'brand.onHullMuted' },
              '& dd': { m: 0, typography: 'body2', ...NUM, textAlign: 'right' },
            }}
          >
            <dt>Saldo pendiente</dt>
            <dd>{saldoUsd != null ? formatUsd(saldoUsd) : 'Sin ventas aún'}</dd>
            <dt>Límite</dt>
            <dd>{formatUsd(limiteUsd)}</dd>
          </Box>
        </>
      ) : (
        <Typography variant="body2" sx={{ color: 'brand.onHullMuted' }}>
          Sin límite de crédito: solo ventas de contado. Edita el cliente para asignarle uno.
        </Typography>
      )}
    </Box>
  )
}
