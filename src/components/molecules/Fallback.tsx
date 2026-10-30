'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ExploreOffOutlinedIcon from '@mui/icons-material/ExploreOffOutlined'

export type FallbackTipo = 'vacio' | 'sin-resultados' | 'error' | 'sin-permiso' | 'no-encontrado'

export interface FallbackProps {
  tipo: FallbackTipo
  titulo: string
  /** Explicación corta (≤ 75ch). */
  texto?: React.ReactNode
  /** Acción que resuelve la situación ("Registrar compra", "Limpiar filtros"). */
  accion?: React.ReactNode
  /** Reemplaza el ícono por defecto del tipo. */
  icono?: React.ReactNode
  /** Para secciones y tarjetas: menos aire y título `subtitle1`. */
  compact?: boolean
  /** Elemento del título (`h1` cuando el fallback es toda la página pública). */
  tituloComo?: React.ElementType
}

const ICONO: Record<FallbackTipo, React.ElementType> = {
  vacio: InboxOutlinedIcon,
  'sin-resultados': SearchOffOutlinedIcon,
  error: ErrorOutlineOutlinedIcon,
  'sin-permiso': LockOutlinedIcon,
  'no-encontrado': ExploreOffOutlinedIcon,
}

/**
 * Fallback único del sistema (spec § Design system › Fallbacks): ícono en un
 * círculo de 44 px sobre `background.subtle`, título, texto y acción. Vacío,
 * sin resultados, error, sin permiso y no encontrado se resuelven aquí;
 * `EmptyState` y `ErrorState` lo envuelven por compatibilidad.
 */
export function Fallback({
  tipo,
  titulo,
  texto,
  accion,
  icono,
  compact = false,
  tituloComo = 'p',
}: FallbackProps) {
  const Icono = ICONO[tipo]
  return (
    <Box
      role={tipo === 'error' ? 'alert' : undefined}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: compact ? 0.75 : 1,
        py: compact ? 3 : 6,
        px: 2,
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          bgcolor: 'background.subtle',
          color: tipo === 'error' ? 'error.main' : 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 0.5,
          '& svg': { fontSize: 22 },
        }}
      >
        {icono ?? <Icono />}
      </Box>
      <Typography variant={compact ? 'subtitle1' : 'h6'} component={tituloComo}>
        {titulo}
      </Typography>
      {texto ? (
        <Typography variant="body2" color="text.secondary" component="div" sx={{ maxWidth: '75ch' }}>
          {texto}
        </Typography>
      ) : null}
      {accion ? <Box sx={{ mt: compact ? 1 : 1.5 }}>{accion}</Box> : null}
    </Box>
  )
}
