'use client'

import * as React from 'react'
import { useTransition } from 'react'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { AppDialog } from '@/components/organisms/AppDialog'
import { bloqueoSchema } from '@/lib/proveedorValidation'

export interface BloqueoDialogProps {
  open: boolean
  /** La acción con su contexto: "Bloquear a Hotel Bahía Azul". */
  titulo?: string
  labelMotivo?: string
  onConfirm: (motivo: string) => Promise<{ error: string | null; fieldErrors?: Record<string, string> }>
  onClose: () => void
}

/**
 * Bloqueo con motivo obligatorio (≥10 caracteres), compartido por clientes y
 * proveedores. `AppDialog size="xs"` (centrado también en el teléfono):
 * mientras guarda no se cierra ni se edita, con el motivo escrito cerrar pide
 * "¿Descartar cambios?", y un segundo envío se ignora. El error de validación
 * o del servidor sobre el motivo va en el campo; cualquier otro, en el
 * `Alert` del diálogo. Tras confirmar con éxito se cierra solo.
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
  const [errorMotivo, setErrorMotivo] = React.useState<string | null>(null)
  const [errorServidor, setErrorServidor] = React.useState<string | null>(null)
  // Doble envío: `isPending` no cambia hasta el re-render; la ref, sí.
  const submittingRef = React.useRef(false)

  const limpiar = () => {
    setMotivo('')
    setErrorMotivo(null)
    setErrorServidor(null)
  }

  const handleClose = () => {
    limpiar()
    onClose()
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submittingRef.current) return
    const safe = bloqueoSchema.safeParse({ motivo })
    if (!safe.success) {
      setErrorMotivo(safe.error.issues[0]?.message ?? 'Motivo inválido')
      return
    }
    submittingRef.current = true
    setErrorMotivo(null)
    setErrorServidor(null)
    startTransition(async () => {
      try {
        const result = await onConfirm(safe.data.motivo)
        if (result.error) {
          if (result.fieldErrors?.motivo) setErrorMotivo(result.fieldErrors.motivo)
          else setErrorServidor(result.error)
          return
        }
        handleClose()
      } finally {
        submittingRef.current = false
      }
    })
  }

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      size="xs"
      title={titulo}
      onSubmit={handleSubmit}
      pending={isPending}
      dirty={motivo.trim() !== ''}
      error={errorServidor}
      primaryAction={
        <Button
          type="submit"
          variant="contained"
          color="error"
          loading={isPending}
          disabled={!motivo.trim()}
        >
          Bloquear
        </Button>
      }
    >
      <TextField
        label={`${labelMotivo} *`}
        fullWidth
        size="small"
        multiline
        minRows={3}
        value={motivo}
        disabled={isPending}
        onChange={(e) => {
          setMotivo(e.target.value)
          setErrorMotivo(null)
        }}
        error={!!errorMotivo}
        helperText={errorMotivo ?? 'Mínimo 10 caracteres.'}
      />
    </AppDialog>
  )
}
