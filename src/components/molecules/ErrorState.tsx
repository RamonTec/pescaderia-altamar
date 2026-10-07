'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'

export interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  message = 'Ocurrió un error al cargar los datos.',
  onRetry,
}: ErrorStateProps) {
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
      <ErrorOutlineOutlinedIcon color="error" sx={{ fontSize: 40, mb: 0.5 }} />
      <Typography variant="h6">Algo salió mal</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        {message}
      </Typography>
      {onRetry ? (
        <Button variant="outlined" onClick={onRetry} sx={{ mt: 1.5 }}>
          Reintentar
        </Button>
      ) : null}
    </Box>
  )
}
