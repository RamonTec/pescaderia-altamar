'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import type { Theme } from '@mui/material/styles'
import { formatUsd } from '@/lib/format'
import type { EstadoCartera, ResumenCartera } from '@/lib/cartera/types'

type EstadoTarjeta = Exclude<EstadoCartera, 'anulada'>

const TARJETAS: { estado: EstadoTarjeta; label: string }[] = [
  { estado: 'vencida', label: 'Vencidas' },
  { estado: 'por_vencer', label: 'Por vencer' },
  { estado: 'pendiente', label: 'Pendientes' },
  { estado: 'pagada', label: 'Pagadas' },
]

export interface CarteraResumenCardsProps {
  resumen: ResumenCartera
  /** Estado filtrado en la tabla (tarjeta marcada). */
  seleccionado?: EstadoCartera | null
  /** Tocar una tarjeta filtra por ese estado; tocar la marcada quita el filtro. */
  onSeleccionar?: (estado: EstadoCartera | null) => void
  /** Etiqueta accesible del grupo ("Resumen de facturas"). */
  label?: string
}

/**
 * Resumen de cartera en cuatro tarjetas (09-cuentas-por-cobrar): Vencidas,
 * Por vencer, Pendientes y Pagadas, con su cantidad y, si el resumen trae
 * montos (admin), su monto. La de vencidas lleva acento de error si hay
 * alguna. Con `onSeleccionar`, cada tarjeta es un botón que filtra la tabla.
 */
export function CarteraResumenCards({
  resumen,
  seleccionado = null,
  onSeleccionar,
  label = 'Resumen de facturas',
}: CarteraResumenCardsProps) {
  const montos = resumen.montos_usd ?? null

  return (
    <Box
      role="group"
      aria-label={label}
      sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}
    >
      {TARJETAS.map(({ estado, label: titulo }) => {
        const cantidad = resumen.conteo[estado]
        const alerta = estado === 'vencida' && cantidad > 0
        const activa = seleccionado === estado
        const contenido = (
          <>
            <Typography variant="body2" color={alerta ? 'error' : 'text.secondary'} sx={{ fontWeight: 500 }}>
              {titulo}
            </Typography>
            <Typography variant="h5" component="p" color={alerta ? 'error' : 'text.primary'}>
              {cantidad}
            </Typography>
            {montos ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatUsd(montos[estado])}
              </Typography>
            ) : null}
          </>
        )
        const sx = (t: Theme) => ({
          display: 'grid',
          justifyItems: 'start',
          alignContent: 'start',
          gap: 0.25,
          p: 1.5,
          minHeight: 64,
          width: '100%',
          textAlign: 'left' as const,
          borderRadius: '8px',
          border: 1,
          borderColor: activa ? 'primary.main' : alerta ? 'error.main' : 'divider',
          boxShadow: activa ? `inset 0 0 0 1px ${t.vars?.palette.primary.main}` : 'none',
          bgcolor: 'background.paper',
          transition: t.transitions.create(['background-color', 'border-color'], {
            duration: t.transitions.duration.short,
          }),
        })
        return onSeleccionar ? (
          <ButtonBase
            key={estado}
            focusRipple
            aria-pressed={activa}
            aria-label={`${titulo}: ${cantidad}${montos ? `, ${formatUsd(montos[estado])}` : ''}${activa ? ' (filtrando)' : ''}`}
            onClick={() => onSeleccionar(activa ? null : estado)}
            sx={(t) => ({ ...sx(t), '&:hover': { bgcolor: 'action.hover' } })}
          >
            {contenido}
          </ButtonBase>
        ) : (
          <Box key={estado} sx={sx}>
            {contenido}
          </Box>
        )
      })}
    </Box>
  )
}

/** Skeleton de una sección de cartera (tarjetas + filas), para `loading.tsx`. */
export function CarteraSeccionSkeleton() {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }} aria-hidden>
      <Skeleton variant="text" width={200} height={32} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={84} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={44} />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={52} sx={{ opacity: 1 - i * 0.2 }} />
      ))}
    </Box>
  )
}
