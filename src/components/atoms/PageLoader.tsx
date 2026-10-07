'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'

export type PageLoaderVariant = 'table' | 'form'

const ROW_COUNT = 6

function TableLoader() {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton variant="text" width={160} height={36} />
        <Skeleton variant="rounded" width={120} height={36} />
      </Box>
      <Skeleton variant="rounded" height={48} />
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={52}
          sx={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </Box>
  )
}

function FormLoader() {
  return (
    <Box sx={{ display: 'grid', gap: 2, maxWidth: 640, width: '100%' }}>
      <Skeleton variant="text" width={200} height={40} />
      <Skeleton variant="rounded" height={56} />
      <Skeleton variant="rounded" height={56} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={56} />
      </Box>
      <Skeleton variant="rounded" height={120} />
      <Skeleton variant="rounded" width={140} height={40} sx={{ alignSelf: 'flex-end' }} />
    </Box>
  )
}

export function PageLoader({ variant = 'table' }: { variant?: PageLoaderVariant }) {
  return (
    <Box sx={{ width: '100%', p: { xs: 1, sm: 0 } }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Cargando…
      </Typography>
      {variant === 'table' ? <TableLoader /> : <FormLoader />}
    </Box>
  )
}
