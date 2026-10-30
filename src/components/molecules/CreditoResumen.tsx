'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import { formatUsd } from '@/lib/format'

export interface CreditoResumenProps {
  limiteUsd: number | null
  /** `null` mientras no exista el módulo de ventas/cobros. */
  saldoUsd: number | null
}

// No es una tabla (el theme aplica cifras tabulares solo en Table/DataGrid):
// la cifra y el detalle las piden aquí.
const NUM = { fontVariantNumeric: 'tabular-nums' }

/**
 * Bloque de crédito de un cliente: el dato que se consulta en el mostrador
 * antes de fiar. Superficie de nivel 0 como las demás secciones de la ficha
 * (la Fase 4 no admite bloques de color). Al superar el límite, la barra pasa
 * a `error` y lo dice con ícono y texto, no solo con el color.
 */
export function CreditoResumen({ limiteUsd, saldoUsd }: CreditoResumenProps) {
  const tieneCredito = limiteUsd != null && limiteUsd > 0
  const uso = tieneCredito && saldoUsd != null ? Math.min(Math.max(saldoUsd, 0) / limiteUsd, 1) : null
  const disponible = tieneCredito && saldoUsd != null ? Math.max(limiteUsd - Math.max(saldoUsd, 0), 0) : null
  const excedido = tieneCredito && saldoUsd != null && saldoUsd > limiteUsd

  return (
    <Box
      component="section"
      aria-labelledby="credito-titulo"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '8px',
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
            <Typography variant="body2" color="text.secondary">
              {disponible != null ? 'Disponible' : 'Límite'}
            </Typography>
            <Typography variant="h5" component="p" sx={NUM}>
              {formatUsd(disponible ?? limiteUsd)}
            </Typography>
          </Box>

          <Box
            role={uso != null ? 'meter' : undefined}
            aria-label={uso != null ? 'Uso del crédito' : undefined}
            aria-valuemin={uso != null ? 0 : undefined}
            aria-valuemax={uso != null ? 100 : undefined}
            aria-valuenow={uso != null ? Math.round(uso * 100) : undefined}
            sx={{ height: 6, bgcolor: 'background.subtle', borderRadius: '3px', overflow: 'hidden' }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${(uso ?? 0) * 100}%`,
                bgcolor: excedido ? 'error.main' : 'text.primary',
                transition: (t) => t.transitions.create('width'),
              }}
            />
          </Box>
          {excedido ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'error.main', mt: -1 }}>
              <ErrorOutlineOutlinedIcon fontSize="small" aria-hidden />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Límite superado
              </Typography>
            </Box>
          ) : null}

          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              rowGap: 0.75,
              '& dt': { typography: 'body2', color: 'text.secondary' },
              '& dd': { m: 0, typography: 'body2', ...NUM, textAlign: 'right' },
            }}
          >
            {/* 17: un saldo negativo es a favor del cliente (nota de crédito o corrección). */}
            <dt>{saldoUsd != null && saldoUsd < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</dt>
            <dd>{saldoUsd != null ? formatUsd(Math.abs(saldoUsd)) : 'Sin ventas aún'}</dd>
            <dt>Límite</dt>
            <dd>{formatUsd(limiteUsd)}</dd>
          </Box>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Sin límite de crédito: solo ventas de contado. Edita el cliente para asignarle uno.
        </Typography>
      )}
    </Box>
  )
}
