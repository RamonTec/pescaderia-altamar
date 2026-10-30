'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { KpiCard } from '@/components/molecules/KpiCard'
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
 * montos (admin), su monto. La de vencidas lleva tono de error si hay alguna.
 * Se apoya en `KpiCard`: con `onSeleccionar`, cada tarjeta es la variante
 * seleccionable y **es** el filtro de la tabla (que entonces oculta sus
 * propios chips de estado con `ocultarFiltroEstados`).
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
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
        gap: 1.5,
      }}
    >
      {TARJETAS.map(({ estado, label: titulo }) => {
        const cantidad = resumen.conteo[estado]
        const alerta = estado === 'vencida' && cantidad > 0
        const activa = seleccionado === estado
        const monto = montos ? formatUsd(montos[estado]) : undefined
        return (
          <KpiCard
            key={estado}
            title={titulo}
            value={cantidad}
            secondary={monto}
            tone={alerta ? 'error' : undefined}
            {...(onSeleccionar
              ? {
                  onClick: () => onSeleccionar(activa ? null : estado),
                  selected: activa,
                  'aria-label': `${titulo}: ${cantidad}${monto ? `, ${monto}` : ''}${activa ? ' (filtrando)' : ''}`,
                }
              : {})}
          />
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
