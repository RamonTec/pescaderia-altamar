'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import type { Theme } from '@mui/material/styles'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined'

export type KpiTono = 'error' | 'warning' | 'success'

export interface KpiCardProps {
  /** Qué mide, en `subtitle2` ("Ventas del día"). */
  title: string
  /** Cifra protagonista ya formateada con `lib/format.ts`. */
  value?: React.ReactNode
  /** Línea secundaria en `caption` ("12,500 kg · 4 facturas"). */
  secondary?: React.ReactNode
  /** Acento de estado: ícono junto al título, borde izquierdo y color de la secundaria. */
  tone?: KpiTono
  /** Enlace a la pantalla de detalle; toda la tarjeta es clicable. */
  href?: string
  /**
   * Variante seleccionable: la tarjeta es un botón que filtra una tabla
   * (`aria-pressed`). Ignora `href`.
   */
  onClick?: () => void
  /** Con `onClick`: la tarjeta marcada (borde de 2 px en `text.primary`). */
  selected?: boolean
  /** Nombre accesible del botón, si el texto visible no basta. */
  'aria-label'?: string
  /** Muestra el skeleton de la tarjeta. */
  loading?: boolean
  /** Contenido extra debajo (chips de tasa, mini listas). */
  children?: React.ReactNode
}

const ICONO_TONO: Record<KpiTono, React.ElementType> = {
  error: ErrorOutlineOutlinedIcon,
  warning: WarningAmberOutlinedIcon,
  success: CheckCircleOutlineOutlinedIcon,
}

/**
 * Tarjeta de un indicador (15-dashboard y resúmenes de cartera): título
 * `subtitle2`, cifra `h5` (Fraunces 500, tabular) y secundaria `caption`.
 * Superficie plana con borde de 1 px, radio 6 y sin sombra. El `tone` lleva
 * ícono además del borde, porque `success` es azul como `primary`: el estado
 * no depende solo del color.
 *
 * Con `onClick` es seleccionable (los KPI que filtran una tabla **son** el
 * filtro): borde de 2 px en `text.primary` cuando está `selected`.
 */
export function KpiCard({
  title,
  value,
  secondary,
  tone,
  href,
  onClick,
  selected = false,
  'aria-label': ariaLabel,
  loading = false,
  children,
}: KpiCardProps) {
  const Icono = tone ? ICONO_TONO[tone] : null
  const contenido = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
        {Icono ? <Icono fontSize="small" sx={{ color: `${tone}.main` }} aria-hidden /> : null}
        <Typography variant="subtitle2" color="text.secondary" component="h3" noWrap>
          {title}
        </Typography>
      </Box>
      {loading ? (
        <>
          <Skeleton variant="text" width="60%" sx={{ typography: 'h5' }} />
          <Skeleton variant="text" width="40%" sx={{ typography: 'caption' }} />
        </>
      ) : (
        <>
          {value !== undefined ? (
            <Typography
              variant="h5"
              component="p"
              sx={{
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {value}
            </Typography>
          ) : null}
          {secondary ? (
            <Typography
              variant="caption"
              component="p"
              sx={{
                color: tone ? `${tone}.main` : 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {secondary}
            </Typography>
          ) : null}
          {children}
        </>
      )}
    </>
  )

  const interactiva = !loading && (!!onClick || !!href)
  const superficie = (theme: Theme) => {
    const v = theme.vars ?? theme
    return {
      display: 'grid',
      gap: 0.5,
      alignContent: 'start',
      justifyItems: 'stretch',
      p: 2,
      width: '100%',
      minWidth: 0,
      textAlign: 'left' as const,
      color: 'inherit',
      textDecoration: 'none',
      borderRadius: '6px',
      border: `1px solid ${v.palette.divider}`,
      bgcolor: 'background.paper',
      boxShadow: 'none',
      ...(tone ? { borderLeft: `3px solid ${v.palette[tone].main}` } : {}),
      // Seleccionada: 2 px en text.primary sin mover el contenido (1 px de
      // borde + 1 px de sombra interior).
      ...(onClick && selected
        ? {
            borderColor: v.palette.text.primary,
            boxShadow: `inset 0 0 0 1px ${v.palette.text.primary}`,
          }
        : {}),
      ...(interactiva
        ? {
            cursor: 'pointer',
            transition: theme.transitions.create(['background-color', 'border-color'], {
              duration: theme.transitions.duration.shortest,
            }),
            '&:hover': { backgroundColor: v.palette.background.subtle },
            // El enlace no es ButtonBase: no hereda el foco del theme.
            '&:focus-visible': { outline: `2px solid ${v.palette.focusRing}`, outlineOffset: 2 },
          }
        : {}),
    }
  }

  const cuerpo = <Box sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>{contenido}</Box>

  if (onClick && !loading) {
    return (
      <ButtonBase
        focusRipple
        aria-pressed={selected}
        aria-label={ariaLabel}
        onClick={onClick}
        sx={superficie}
      >
        {cuerpo}
      </ButtonBase>
    )
  }

  return (
    <Paper
      component={href && !loading ? Link : 'div'}
      {...(href && !loading ? { href } : {})}
      sx={superficie}
    >
      {cuerpo}
    </Paper>
  )
}
