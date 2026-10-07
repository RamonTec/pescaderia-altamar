'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { PeneroStripes } from '@/components/atoms/PeneroStripes'

/**
 * Plantilla de las pantallas de acceso (login, recuperar, actualizar
 * contraseña). md+: panel de casco a la izquierda (5/12) y formulario a la
 * derecha. xs/sm: el panel se reduce a una banda superior con las franjas.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
        gridTemplateRows: { xs: 'auto 1fr', md: '1fr' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="aside"
        sx={{
          bgcolor: 'brand.hull',
          color: 'brand.onHull',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, pt: { xs: 2.5, md: 7 }, pb: { xs: 2, md: 4 } }}>
          <Typography
            component="p"
            variant="h3"
            sx={{ fontSize: { xs: '1.75rem', md: '3.25rem' }, maxWidth: '8ch' }}
          >
            Altamar Sea Food
          </Typography>
          <Typography
            sx={{
              display: { xs: 'none', md: 'block' },
              color: 'brand.onHullMuted',
              mt: 2,
              maxWidth: '28ch',
            }}
          >
            Compras, inventario por kilo y ventas del día en un solo lugar.
          </Typography>
        </Box>
        <PeneroStripes />
      </Box>

      <Box
        component="main"
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          px: { xs: 2, sm: 4, md: 8 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 380 }}>{children}</Box>
      </Box>
    </Box>
  )
}

/** Skeleton del formulario de acceso (para `loading.tsx`); el panel ya está montado. */
export function AuthFormSkeleton() {
  return (
    <Box sx={{ display: 'grid', gap: 2.5 }} aria-busy aria-label="Cargando">
      <Skeleton variant="text" width={140} height={48} />
      <Skeleton variant="rounded" height={56} />
      <Skeleton variant="rounded" height={56} />
      <Skeleton variant="rounded" height={48} />
      <Skeleton variant="text" width={160} />
    </Box>
  )
}
