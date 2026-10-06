'use client'

import * as React from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import {
  actualizarPasswordAction,
  type ActualizarPasswordState,
} from '@/app/actualizar-password/actions'

const initialState: ActualizarPasswordState = { error: null, success: null }

export function ActualizarPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    actualizarPasswordAction,
    initialState
  )

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Establecer nueva contraseña
      </Typography>
      <Box component="form" action={formAction} sx={{ display: 'grid', gap: 2 }}>
        <TextField
          name="password"
          label="Nueva contraseña"
          type="password"
          required
          fullWidth
          autoComplete="new-password"
        />
        <TextField
          name="confirm"
          label="Confirmar contraseña"
          type="password"
          required
          fullWidth
          autoComplete="new-password"
        />
        {state.error ? <Alert severity="error">{state.error}</Alert> : null}
        {state.success ? (
          <>
            <Alert severity="success">{state.success}</Alert>
            <Button component={Link} href="/login" variant="contained">
              Ir al login
            </Button>
          </>
        ) : (
          <Button
            type="submit"
            variant="contained"
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : null}
          >
            Guardar contraseña
          </Button>
        )}
      </Box>
    </Box>
  )
}
