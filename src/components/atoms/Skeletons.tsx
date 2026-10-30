'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { ESPACIO } from '@/theme/tokens'

/**
 * Skeletons con la forma de cada plantilla (spec § Design system › Carga y
 * feedback). Pulso (DS-7, lo pone el theme) y las mismas medidas que la
 * pantalla real, así nada salta al cargar:
 *
 * - `SkeletonTabla`: barra (búsqueda de 340 + segmentado), encabezado de 40 y
 *   filas de 56, como `AppDataGrid`.
 * - `SkeletonFicha`: encabezado de ficha + secciones de nivel 0.
 * - `SkeletonKpis`: fila de tarjetas como `KpiCard`.
 * - `SkeletonGrafico`: tarjeta como `ChartCard`.
 * - `SkeletonFormulario`: secciones con etiqueta + campo de 40.
 *
 * Todos son decorativos (`aria-hidden`): el aviso para el lector de pantalla
 * lo da `PageLoader` o el `aria-busy` de la sección.
 */

const SUPERFICIE = {
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
  minWidth: 0,
} as const

/** Encabezado de página (`PageHeader`): título `h4` y acción a la derecha. */
export function SkeletonEncabezado({ accion = true }: { accion?: boolean }) {
  return (
    <Box
      aria-hidden
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 1.5,
        mb: { xs: ESPACIO.bloquesPaginaXs, md: ESPACIO.bloquesPagina },
      }}
    >
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Skeleton variant="text" width={220} sx={{ typography: 'h4' }} />
        <Skeleton variant="text" width={300} sx={{ typography: 'body2', maxWidth: '60vw' }} />
      </Box>
      {accion ? (
        <Skeleton
          variant="rounded"
          width={140}
          height={36}
          sx={{ display: { xs: 'none', sm: 'block' } }}
        />
      ) : null}
    </Box>
  )
}

export function SkeletonTabla({
  filas = 6,
  estados = true,
}: {
  filas?: number
  /** Muestra el segmentado de estado junto a la búsqueda. */
  estados?: boolean
}) {
  return (
    <Box aria-hidden sx={{ ...SUPERFICIE, borderRadius: '6px', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
        <Skeleton variant="rounded" height={40} sx={{ width: { xs: '100%', sm: 340 } }} />
        {estados ? <Skeleton variant="rounded" width={260} height={38} sx={{ borderRadius: '8px' }} /> : null}
      </Box>
      <Box sx={{ height: 40, bgcolor: 'background.subtle', borderTop: 1, borderColor: 'divider' }} />
      {Array.from({ length: filas }).map((_, i) => (
        <Box
          key={i}
          sx={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            px: 2,
            borderTop: i === 0 ? 0 : 1,
            borderColor: 'rowDivider',
            opacity: 1 - i * 0.1,
          }}
        >
          <Skeleton variant="text" sx={{ flex: 2, typography: 'body2' }} />
          <Skeleton variant="text" sx={{ flex: 1, typography: 'body2' }} />
          <Skeleton
            variant="text"
            sx={{ flex: 1, typography: 'body2', display: { xs: 'none', sm: 'block' } }}
          />
          <Skeleton variant="rounded" width={32} height={32} sx={{ flexShrink: 0 }} />
        </Box>
      ))}
    </Box>
  )
}

/** Una sección de ficha (`FichaSeccion`): título `h6` y filas de datos. */
export function SkeletonSeccion({ filas = 3 }: { filas?: number }) {
  return (
    <Box
      aria-hidden
      sx={{ ...SUPERFICIE, borderRadius: '8px', p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}
    >
      <Skeleton variant="text" width={160} sx={{ typography: 'h6' }} />
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        {Array.from({ length: filas }).map((_, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2 }}>
            <Skeleton variant="text" width={120} sx={{ typography: 'body2', flexShrink: 0 }} />
            <Skeleton variant="text" sx={{ typography: 'body2', flex: 1, maxWidth: 280 }} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export function SkeletonFicha({ secciones = 2 }: { secciones?: number }) {
  return (
    <Box aria-hidden sx={{ display: 'grid', gap: { xs: ESPACIO.bloquesPaginaXs, md: ESPACIO.bloquesPagina } }}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Skeleton variant="text" width={90} sx={{ typography: 'body2' }} />
        <Skeleton variant="text" width={280} sx={{ typography: 'h5', maxWidth: '80vw' }} />
        <Skeleton variant="text" width={200} sx={{ typography: 'body2' }} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
        {Array.from({ length: secciones }).map((_, i) => (
          <SkeletonSeccion key={i} filas={i === 0 ? 4 : 3} />
        ))}
      </Box>
    </Box>
  )
}

export function SkeletonKpis({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: `repeat(${Math.min(cantidad, 4)}, minmax(0, 1fr))`,
        },
      }}
    >
      {Array.from({ length: cantidad }).map((_, i) => (
        <Box key={i} sx={{ ...SUPERFICIE, borderRadius: '6px', p: 2, display: 'grid', gap: 0.25 }}>
          <Skeleton variant="text" width="50%" sx={{ typography: 'subtitle2' }} />
          <Skeleton variant="text" width="60%" sx={{ typography: 'h5' }} />
          <Skeleton variant="text" width="40%" sx={{ typography: 'caption' }} />
        </Box>
      ))}
    </Box>
  )
}

export function SkeletonGrafico({
  titulo,
  altura = 240,
}: {
  /** Título real de la sección (se ve mientras carga); si no, una línea de skeleton. */
  titulo?: string
  altura?: number
}) {
  return (
    <Box
      sx={{ ...SUPERFICIE, borderRadius: '8px', p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}
    >
      {titulo ? (
        <Typography variant="h6" component="h3">
          {titulo}
        </Typography>
      ) : (
        <Skeleton variant="text" width={180} sx={{ typography: 'h6' }} aria-hidden />
      )}
      <Skeleton variant="rounded" height={altura} aria-hidden />
    </Box>
  )
}

/** Un campo con etiqueta fija arriba (DS-1): etiqueta de 13 px, 6 px y campo de 40. */
function SkeletonCampo() {
  return (
    <Box sx={{ display: 'grid', gap: ESPACIO.formEtiquetaACampo }}>
      <Skeleton variant="text" width="35%" sx={{ typography: 'label' }} />
      <Skeleton variant="rounded" height={40} />
    </Box>
  )
}

export function SkeletonFormulario({
  secciones = 2,
  campos = 4,
}: {
  secciones?: number
  /** Campos por sección (en dos columnas desde `sm`). */
  campos?: number
}) {
  return (
    <Box aria-hidden sx={{ display: 'grid', gap: ESPACIO.formSecciones, maxWidth: 720, width: '100%' }}>
      {Array.from({ length: secciones }).map((_, s) => (
        <Box key={s}>
          <Box sx={{ pb: 1, mb: ESPACIO.formTituloAContenido, borderBottom: 1, borderColor: 'divider' }}>
            <Skeleton variant="text" width={180} sx={{ typography: 'sectionTitle' }} />
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
              rowGap: ESPACIO.formCampoVertical,
              columnGap: ESPACIO.formColumnas,
            }}
          >
            {Array.from({ length: campos }).map((_, c) => (
              <SkeletonCampo key={c} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
