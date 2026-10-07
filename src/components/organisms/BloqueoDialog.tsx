'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useTransition } from 'react'
import { bloqueoSchema } from '@/lib/proveedorValidation'

export interface BloqueoDialogProps {
  open: boolean
  titulo?: string
  labelMotivo?: string
  onConfirm: (motivo: string) => Promise<{ error: string | null; fieldErrors?: Record<string, string> }>
  onClose: () => void
}

/**
 * Diálogo genérico de bloqueo con motivo obligatorio (≥10 caracteres) y
 * botón `error` con loader interno. Recibe `onConfirm(motivo)` para que
 * clientes pueda adoptarlo también.
 */
export function BloqueoDialog({
  open,
  titulo = 'Bloquear',
  labelMotivo = 'Motivo del bloqueo',
  onConfirm,
  onClose,
}: BloqueoDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [motivo, setMotivo] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const handleClose = () => {
    setMotivo('')
    setError(null)
    onClose()
  }

  const handleConfirm = () => {
    const safe = bloqueoSchema.safeParse({ motivo })
    if (!safe.success) {
      setError(safe.error.issues[0]?.message ?? 'Motivo inválido')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await onConfirm(safe.data.motivo)
      if (result.error) {
        setError(result.fieldErrors?.motivo ?? result.error)
        return
      }
      setMotivo('')
      setError(null)
      onClose()
    })
  }

  return (
    <Dialog open={open} onClose={isPending ? undefined : handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <TextField
          label={`${labelMotivo} *`}
          fullWidth
          multiline
          minRows={3}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value)
            setError(null)
          }}
          error={!!error}
          helperText={error}
          autoFocus
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={isPending || !motivo.trim()}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Bloquear
        </Button>
      </DialogActions>
    </Dialog>
  )
}
