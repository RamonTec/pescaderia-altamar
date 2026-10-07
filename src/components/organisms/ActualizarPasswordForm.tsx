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
import { actualizarPasswordAction } from '@/app/(auth)/actualizar-password/actions'

const schema = z
  .object({
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  })

type FormValues = z.infer<typeof schema>

export function ActualizarPasswordForm() {
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
      formData.set('password', values.password)
      formData.set('confirm', values.confirm)
      const result = await actualizarPasswordAction({ error: null, success: null }, formData)
      setServerError(result.error)
      setServerSuccess(result.success)
    })
  })

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Establecer nueva contraseña
      </Typography>
      <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2 }}>
        <TextField
          label="Nueva contraseña"
          type="password"
          fullWidth
          autoComplete="new-password"
          error={!!errors.password}
          helperText={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Confirmar contraseña"
          type="password"
          fullWidth
          autoComplete="new-password"
          error={!!errors.confirm}
          helperText={errors.confirm?.message}
          {...register('confirm')}
        />
        {serverError ? <Alert severity="error">{serverError}</Alert> : null}
        {serverSuccess ? (
          <>
            <Alert severity="success">{serverSuccess}</Alert>
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
