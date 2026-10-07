'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  /** Versión para secciones de una ficha: menos aire y título `subtitle1`. */
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: compact ? 0.5 : 1,
        py: compact ? 3 : 6,
        px: 2,
      }}
    >
      {icon ? <Box sx={{ color: 'text.secondary', mb: 0.5 }}>{icon}</Box> : null}
      {compact ? (
        <Typography variant="subtitle1" component="p">
          {title}
        </Typography>
      ) : (
        <Typography variant="h6">{title}</Typography>
      )}
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: compact ? 1 : 1.5 }}>{action}</Box> : null}
    </Box>
  )
}
