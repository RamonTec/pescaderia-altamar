'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

export interface ChartCardProps {
  title: string
  /** Ayuda bajo el título (qué mide, de dónde sale). */
  help?: React.ReactNode
  /** Acción a la derecha del título (toggle, filtro). */
  action?: React.ReactNode
  loading?: boolean
  /** Mensaje de error del bloque; muestra `ErrorState`. */
  error?: string | null
  /** Reintento del error; por defecto `router.refresh()` (vuelve a pedir la página). */
  onRetry?: () => void
  /** Sin datos: muestra `EmptyState compact`. */
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  /** Altura del skeleton (la del gráfico). */
  skeletonHeight?: number
  children?: React.ReactNode
}

/**
 * Tarjeta de sección del dashboard (15): radio 8, borde `divider`, sin
 * sombra. Título `h6`, ayuda, acción opcional y los estados del bloque:
 * skeleton al cargar, `ErrorState` en error, `EmptyState compact` sin datos.
 */
export function ChartCard({
  title,
  help,
  action,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyTitle = 'Sin datos en el período',
  emptyDescription,
  skeletonHeight = 240,
  children,
}: ChartCardProps) {
  const router = useRouter()
  let cuerpo: React.ReactNode
  if (loading) {
    cuerpo = <Skeleton variant="rounded" height={skeletonHeight} />
  } else if (error) {
    cuerpo = <ErrorState message={error} onRetry={onRetry ?? (() => router.refresh())} />
  } else if (empty) {
    cuerpo = (
      <EmptyState
        compact
        icon={<InsertChartOutlinedIcon />}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  } else {
    cuerpo = (
      <Fade in timeout={200}>
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Fade>
    )
  }

  return (
    <Paper component="section" sx={{ p: 2, display: 'grid', gap: 1.5, minWidth: 0, alignContent: 'start' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
          {help ? (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ maxWidth: '75ch' }}>
              {help}
            </Typography>
          ) : null}
        </Box>
        {action && !loading ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Box>
      {cuerpo}
    </Paper>
  )
}
