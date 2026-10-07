'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import ScaleIcon from '@mui/icons-material/Scale'
import { loginAction } from '@/app/login/actions'

const schema = z.object({
  email: z.string().min(1, 'Ingresa tu email').email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', values.email)
      formData.set('password', values.password)
      const result = await loginAction({ error: null }, formData)
      setServerError(result.error)
    })
  })

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

      <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2 }}>
        <TextField
          label="Email"
          type="email"
          fullWidth
          autoComplete="email"
          error={!!errors.email}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Contraseña"
          type="password"
          fullWidth
          autoComplete="current-password"
          error={!!errors.password}
          helperText={errors.password?.message}
          {...register('password')}
        />
        {serverError ? <Alert severity="error">{serverError}</Alert> : null}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isPending || (isSubmitted && !isValid)}
          startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : null}
        >
          Entrar
        </Button>
        <Button component={Link} href="/recuperar" size="small">
          Olvidé mi contraseña
        </Button>
      </Box>
    </Box>
  )
}
