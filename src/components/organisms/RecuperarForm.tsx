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
import { recuperarAction, type RecuperarState } from '@/app/recuperar/actions'

const initialState: RecuperarState = { error: null, success: null }

export function RecuperarForm() {
  const [state, formAction, isPending] = useActionState(
    recuperarAction,
    initialState
  )

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Recuperar contraseña
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
        {state.error ? <Alert severity="error">{state.error}</Alert> : null}
        {state.success ? <Alert severity="success">{state.success}</Alert> : null}
        <Button
          type="submit"
          variant="contained"
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : null}
        >
          Enviar enlace
        </Button>
        <Button component={Link} href="/login" size="small">
          Volver al login
        </Button>
      </Box>
    </Box>
  )
}
