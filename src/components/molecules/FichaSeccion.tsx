'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'

export interface FichaSeccionProps {
  titulo: string
  /** Acción a la derecha del título (ej. botón "Agregar"). */
  accion?: React.ReactNode
  /** Muestra skeleton de filas en vez del contenido mientras carga. */
  loading?: boolean
  children: React.ReactNode
}

/** Sección de una ficha de detalle (cliente, proveedor…): título h6 + contenido. */
export function FichaSeccion({ titulo, accion, loading = false, children }: FichaSeccionProps) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 2, alignContent: 'start' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h6" component="h2">
          {titulo}
        </Typography>
        {accion}
      </Box>
      {loading ? (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Skeleton variant="rounded" height={20} />
          <Skeleton variant="rounded" height={20} width="80%" />
          <Skeleton variant="rounded" height={20} width="60%" />
        </Box>
      ) : (
        children
      )}
    </Paper>
  )
}

/** Lista de datos etiqueta → valor (`<dl>`), dos columnas desde `sm`. */
export function FichaDatos({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, 160px) 1fr' },
        columnGap: 2,
        rowGap: { xs: 0.25, sm: 1.25 },
        '& dt': { color: 'text.secondary', typography: 'body2' },
        '& dd': { m: 0, typography: 'body2', mb: { xs: 1.25, sm: 0 }, minWidth: 0, overflowWrap: 'anywhere' },
      }}
    >
      {children}
    </Box>
  )
}

export function FichaDato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </>
  )
}
