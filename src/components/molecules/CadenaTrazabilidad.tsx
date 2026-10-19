'use client'

import * as React from 'react'
import NextLink from 'next/link'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined'

export interface EslabonCadena {
  clave: string
  icono: React.ReactNode
  titulo: React.ReactNode
  /** Cifras o datos, una por línea (`caption`, tabulares). */
  lineas: React.ReactNode[]
  /** Enlace del eslabón (ficha del lote, compras…). */
  href?: string
  hrefLabel?: string
}

export interface CadenaTrazabilidadProps {
  eslabones: readonly EslabonCadena[]
  /** "Cadena del lote FIL-261019-1". */
  ariaLabel: string
}

/**
 * Cadena de trazabilidad genérica (17): eslabones con ícono, título, cifras
 * y enlace, unidos por flechas. Horizontal en `md+` y vertical en `xs`/`sm`.
 * Solo tokens del tema (bordes `divider`, radio 8, sin sombras).
 */
export function CadenaTrazabilidad({ eslabones, ariaLabel }: CadenaTrazabilidadProps) {
  return (
    <Box
      component="ol"
      aria-label={ariaLabel}
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'stretch' },
        gap: 0.5,
      }}
    >
      {eslabones.map((e, i) => (
        <React.Fragment key={e.clave}>
          {i > 0 ? (
            <Box
              component="li"
              aria-hidden
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                flexShrink: 0,
                '& svg': { transform: { xs: 'rotate(90deg)', md: 'none' } },
              }}
            >
              <ArrowForwardOutlinedIcon fontSize="small" />
            </Box>
          ) : null}
          <Box
            component="li"
            sx={{
              flex: { md: '1 1 0' },
              minWidth: 0,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
              display: 'grid',
              gap: 0.5,
              alignContent: 'start',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
              <Box sx={{ display: 'inline-flex', '& svg': { fontSize: 20 } }}>{e.icono}</Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', minWidth: 0 }}>
                {e.titulo}
              </Typography>
            </Box>
            {e.lineas.map((l, j) => (
              <Typography
                key={j}
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
              >
                {l}
              </Typography>
            ))}
            {e.href ? (
              <Link component={NextLink} href={e.href} variant="caption" underline="hover">
                {e.hrefLabel ?? 'Ver detalle'}
              </Link>
            ) : null}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  )
}
