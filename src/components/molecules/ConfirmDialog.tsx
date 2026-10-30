'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import Typography from '@mui/material/Typography'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const PADDING_X = { xs: 2, sm: 3 } as const

/**
 * Confirmación (spec § Confirmaciones). Misma superficie y padding que
 * `AppDialog`: una sola superficie elevada, 24 px (16 en `xs`) y el pie
 * separado por `dialogDivider`. "Cancelar" como texto en `text.secondary`.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = React.useId()
  const messageId = React.useId()
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
    >
      <Box sx={{ px: PADDING_X, pt: 3, pb: message ? 1.5 : 3 }}>
        <Typography id={titleId} variant="h6" component="h2">
          {title}
        </Typography>
      </Box>
      {message ? (
        <Box sx={{ px: PADDING_X, pb: 3 }}>
          <Typography id={messageId} variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Box>
      ) : null}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.5,
          px: PADDING_X,
          py: 2,
          borderTop: 1,
          borderColor: 'dialogDivider',
        }}
      >
        <Button
          onClick={onCancel}
          disabled={loading}
          color="inherit"
          sx={{ color: 'text.secondary' }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          color={destructive ? 'error' : 'primary'}
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {confirmLabel}
        </Button>
      </Box>
    </Dialog>
  )
}
