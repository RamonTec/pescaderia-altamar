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
import { updatePerfilAction } from '@/app/(protected)/perfil/actions'

const schema = z
  .object({
    nombre: z.string(),
    password: z.string(),
    confirm: z.string(),
  })
  .refine((data) => !data.password || data.password.length >= 6, {
    message: 'La contraseña debe tener al menos 6 caracteres',
    path: ['password'],
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  })

type FormValues = z.infer<typeof schema>

export function PerfilForm({
  email,
  nombre,
}: {
  email: string
  nombre: string | null
}) {
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
    defaultValues: {
      nombre: nombre ?? '',
      password: '',
      confirm: '',
    },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    setServerSuccess(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('nombre', values.nombre)
      formData.set('password', values.password)
      formData.set('confirm', values.confirm)
      const result = await updatePerfilAction({ error: null, success: null }, formData)
      setServerError(result.error)
      setServerSuccess(result.success)
    })
  })

  return (
    <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2 }}>
      <TextField label="Email" value={email} disabled fullWidth size="small" />
      <TextField
        label="Nombre"
        fullWidth
        size="small"
        error={!!errors.nombre}
        helperText={errors.nombre?.message}
        {...register('nombre')}
      />
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
        Cambiar contraseña (dejar vacío para no cambiarla)
      </Typography>
      <TextField
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        fullWidth
        size="small"
        error={!!errors.password}
        helperText={errors.password?.message}
        {...register('password')}
      />
      <TextField
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        fullWidth
        size="small"
        error={!!errors.confirm}
        helperText={errors.confirm?.message}
        {...register('confirm')}
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
          Guardar
        </Button>
      </Box>
    </Box>
  )
}
