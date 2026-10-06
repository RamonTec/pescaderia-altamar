'use client'

import * as React from 'react'
import { useActionState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { crearUsuarioAction, type UsuariosState } from '@/app/(protected)/usuarios/actions'

const initialState: UsuariosState = { error: null, success: null }

export function CrearUsuarioForm() {
  const [state, formAction, isPending] = useActionState(
    crearUsuarioAction,
    initialState
  )

  return (
    <Box component="form" action={formAction} sx={{ display: 'grid', gap: 2 }}>
      <Typography variant="h6">Invitar / crear usuario</Typography>
      <TextField name="email" label="Email" type="email" required fullWidth />
      <TextField name="nombre" label="Nombre" required fullWidth />
      <TextField
        name="password"
        label="Contraseña inicial"
        type="password"
        required
        fullWidth
        autoComplete="new-password"
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
          Crear usuario
        </Button>
      </Box>
    </Box>
  )
}
