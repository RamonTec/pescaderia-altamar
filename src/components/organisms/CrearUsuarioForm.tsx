'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { crearUsuarioAction } from '@/app/(protected)/usuarios/actions'

const schema = z.object({
  email: z.string().min(1, 'Ingresa el email').email('Email inválido'),
  nombre: z.string().min(1, 'Ingresa el nombre'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

export function CrearUsuarioForm() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [serverSuccess, setServerSuccess] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
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
      formData.set('nombre', values.nombre)
      formData.set('password', values.password)
      const result = await crearUsuarioAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
      } else {
        setServerSuccess(result.success)
        reset()
      }
    })
  })

  return (
    <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2 }}>
      <Typography variant="h6">Invitar / crear usuario</Typography>
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
        label="Nombre"
        fullWidth
        error={!!errors.nombre}
        helperText={errors.nombre?.message}
        {...register('nombre')}
      />
      <TextField
        label="Contraseña inicial"
        type="password"
        fullWidth
        autoComplete="new-password"
        error={!!errors.password}
        helperText={errors.password?.message}
        {...register('password')}
      />
      {serverError ? <Alert severity="error">{serverError}</Alert> : null}
      {serverSuccess ? <Alert severity="success">{serverSuccess}</Alert> : null}
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
