'use client'

import * as React from 'react'
import { useActionState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import ScaleIcon from '@mui/icons-material/Scale'
import { loginAction, type LoginState } from '@/app/login/actions'

const initialState: LoginState = { error: null }

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState
  )

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <ScaleIcon color="primary" sx={{ fontSize: 32, mr: 1 }} />
        <Typography variant="h5" component="h1">
          Pescadería
        </Typography>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Gestión interna · Ingresa con tu cuenta
      </Typography>

      <Box component="form" action={formAction} sx={{ display: 'grid', gap: 2 }}>
        <TextField
          name="email"
          label="Email"
          type="email"
          required
          fullWidth
          autoComplete="email"
        />
        <TextField
          name="password"
          label="Contraseña"
          type="password"
          required
          fullWidth
          autoComplete="current-password"
        />
        {state.error ? <Alert severity="error">{state.error}</Alert> : null}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : null}
        >
          Entrar
        </Button>
      </Box>
    </Box>
  )
}
