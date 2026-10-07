'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1,
        py: 6,
        px: 2,
      }}
    >
      {icon ? <Box sx={{ color: 'text.secondary', mb: 0.5 }}>{icon}</Box> : null}
      <Typography variant="h6">{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 1.5 }}>{action}</Box> : null}
    </Box>
  )
}
