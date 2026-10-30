'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { useNavigationPending } from '@/components/atoms/NavigationProgress'
import {
  SkeletonEncabezado,
  SkeletonFicha,
  SkeletonFormulario,
  SkeletonGrafico,
  SkeletonKpis,
  SkeletonTabla,
} from '@/components/atoms/Skeletons'
import { ESPACIO } from '@/theme/tokens'

export type PageLoaderVariant = 'table' | 'kpisTable' | 'form' | 'ficha' | 'dashboard'

const BLOQUES = { xs: ESPACIO.bloquesPaginaXs, md: ESPACIO.bloquesPagina } as const

function TableLoader() {
  return (
    <>
      <SkeletonEncabezado />
      <SkeletonTabla />
    </>
  )
}

/** Listado con tarjetas de resumen encima (`/tasas`). */
function KpisTableLoader() {
  return (
    <>
      <SkeletonEncabezado />
      <Box sx={{ display: 'grid', gap: BLOQUES }}>
        <SkeletonKpis />
        <SkeletonTabla estados={false} />
      </Box>
    </>
  )
}

function FormLoader() {
  return (
    <>
      <SkeletonEncabezado accion={false} />
      <SkeletonFormulario />
    </>
  )
}

/** Dashboard (15): encabezado, fila de KPIs y dos bloques de gráficos. */
function DashboardLoader() {
  return (
    <>
      <SkeletonEncabezado accion={false} />
      <Box sx={{ display: 'grid', gap: BLOQUES }}>
        <SkeletonKpis />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <SkeletonGrafico altura={260} />
          <SkeletonGrafico altura={260} />
        </Box>
      </Box>
    </>
  )
}

function FichaLoader() {
  return <SkeletonFicha />
}

const LOADERS: Record<PageLoaderVariant, () => React.ReactElement> = {
  table: TableLoader,
  kpisTable: KpisTableLoader,
  form: FormLoader,
  ficha: FichaLoader,
  dashboard: DashboardLoader,
}

/**
 * Skeleton de página para los `loading.tsx` (spec § Carga y feedback): la
 * forma de la plantilla, armada con `atoms/Skeletons`. El aviso «Cargando…»
 * va en una región `role="status"` oculta a la vista. Mientras está montado
 * corre la barra de navegación.
 */
export function PageLoader({
  variant = 'table',
  children,
}: {
  variant?: PageLoaderVariant
  /** Skeleton extra debajo del de la variante (ej. una sección de la ficha). */
  children?: React.ReactNode
}) {
  useNavigationPending(true)
  return (
    <Box aria-busy="true" sx={{ width: '100%' }}>
      <Box
        role="status"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        Cargando…
      </Box>
      {React.createElement(LOADERS[variant])}
      {children ? <Box sx={{ mt: BLOQUES }}>{children}</Box> : null}
    </Box>
  )
}
