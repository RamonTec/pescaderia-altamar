'use client'

import * as React from 'react'
import { useActionState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { updatePerfilAction, type PerfilState } from '@/app/(protected)/perfil/actions'

const initialState: PerfilState = { error: null, success: null }

export function PerfilForm({
  email,
  nombre,
}: {
  email: string
  nombre: string | null
}) {
  const [state, formAction, isPending] = useActionState(
    updatePerfilAction,
    initialState
  )

  return (
    <Box component="form" action={formAction} sx={{ display: 'grid', gap: 2 }}>
      <TextField label="Email" value={email} disabled fullWidth />
      <TextField
        name="nombre"
        label="Nombre"
        defaultValue={nombre ?? ''}
        fullWidth
      />
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
        Cambiar contraseña (dejar vacío para no cambiarla)
      </Typography>
      <TextField
        name="password"
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        fullWidth
      />
      <TextField
        name="confirm"
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        fullWidth
      />
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}
      {state.success ? <Alert severity="success">{state.success}</Alert> : null}
      <Box>
        <Button
          type="submit"
          variant="contained"
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : null}
        >
          Guardar
        </Button>
      </Box>
    </Box>
  )
}
