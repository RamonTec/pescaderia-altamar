'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'

export type KpiTono = 'error' | 'warning' | 'success'

export interface KpiCardProps {
  /** Qué mide, en `body2` ("Ventas del día"). */
  title: string
  /** Cifra protagonista ya formateada con `lib/format.ts`. */
  value?: React.ReactNode
  /** Línea secundaria en `caption` ("12,500 kg · 4 facturas"). */
  secondary?: React.ReactNode
  /** Acento de estado: borde izquierdo y color de la secundaria. */
  tone?: KpiTono
  /** Enlace a la pantalla de detalle; toda la tarjeta es clicable. */
  href?: string
  /** Muestra el skeleton de la tarjeta. */
  loading?: boolean
  /** Contenido extra debajo (chips de tasa, mini listas). */
  children?: React.ReactNode
}

/**
 * Tarjeta de un indicador (15-dashboard): título `body2`, cifra `h5`
 * (Barlow Condensed, tabular), secundaria `caption`. Superficie plana con
 * borde de 1 px (radio 8, sin sombra); el acento de estado es el único color.
 */
export function KpiCard({ title, value, secondary, tone, href, loading = false, children }: KpiCardProps) {
  const contenido = (
    <>
      <Typography variant="body2" color="text.secondary" component="h3">
        {title}
      </Typography>
      {loading ? (
        <>
          <Skeleton variant="text" width="60%" sx={{ fontSize: '1.625rem' }} />
          <Skeleton variant="text" width="40%" />
        </>
      ) : (
        <>
          {value !== undefined ? (
            <Typography
              variant="h5"
              component="p"
              sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {value}
            </Typography>
          ) : null}
          {secondary ? (
            <Typography
              variant="caption"
              component="p"
              sx={{ color: tone ? `${tone}.main` : 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
            >
              {secondary}
            </Typography>
          ) : null}
          {children}
        </>
      )}
    </>
  )

  return (
    <Paper
      component={href && !loading ? Link : 'div'}
      {...(href && !loading ? { href } : {})}
      sx={(theme) => ({
        display: 'grid',
        gap: 0.5,
        alignContent: 'start',
        p: 2,
        minWidth: 0,
        color: 'inherit',
        textDecoration: 'none',
        borderLeft: tone ? `3px solid ${theme.vars?.palette[tone].main}` : undefined,
        ...(href
          ? {
              cursor: 'pointer',
              transition: theme.transitions.create('background-color', {
                duration: theme.transitions.duration.short,
              }),
              '&:hover': { backgroundColor: theme.vars?.palette.action.hover },
              '&:focus-visible': {
                outline: `2px solid ${theme.vars?.palette.primary.main}`,
                outlineOffset: 2,
              },
            }
          : {}),
      })}
    >
      <Box sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>{contenido}</Box>
    </Paper>
  )
}
