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
import { recuperarAction } from '@/app/recuperar/actions'

const schema = z.object({
  email: z.string().min(1, 'Ingresa tu email').email('Email inválido'),
})

type FormValues = z.infer<typeof schema>

export function RecuperarForm() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [serverSuccess, setServerSuccess] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    setServerSuccess(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', values.email)
      const result = await recuperarAction({ error: null, success: null }, formData)
      setServerError(result.error)
      setServerSuccess(result.success)
    })
  })

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Recuperar contraseña
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
        {serverError ? <Alert severity="error">{serverError}</Alert> : null}
        {serverSuccess ? <Alert severity="success">{serverSuccess}</Alert> : null}
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
