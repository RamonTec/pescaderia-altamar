'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import NextLink from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import CircularProgress from '@mui/material/CircularProgress'
import { PasswordField } from '@/components/atoms/PasswordField'
import { loginAction } from '@/app/(auth)/login/actions'
import { useGlobalLoader } from '@/lib/useGlobalLoader'

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu email').email('Revisa el email, falta algo'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const globalLoader = useGlobalLoader()

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
    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', values.email)
      formData.set('password', values.password)
      // Si el login sale bien, la action redirige a `/`: el loader se libera
      // solo al cambiar de ruta. Si falla, se libera aquí.
      const release = globalLoader.show('Entrando', { untilNavigation: true })
      // `finally`: si la action lanza (red caída), el loader no queda pegado.
      try {
        const result = await loginAction({ error: null }, formData)
        setServerError(result.error)
      } finally {
        release()
      }
    })
  })

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Entrar
      </Typography>

      <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2.5 }}>
        <TextField
          label="Email"
          type="email"
          fullWidth
          autoFocus
          autoComplete="email"
          error={!!errors.email}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Contraseña"
          fullWidth
          autoComplete="current-password"
          error={!!errors.password}
          helperText={errors.password?.message}
          {...register('password')}
        />

        <Collapse in={!!serverError} unmountOnExit>
          <Alert severity="error">{serverError}</Alert>
        </Collapse>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isPending}
          startIcon={isPending ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ mt: 0.5, minHeight: 48 }}
        >
          {isPending ? 'Entrando…' : 'Entrar'}
        </Button>

        <Link
          component={NextLink}
          href="/recuperar"
          variant="body2"
          underline="always"
          sx={{ justifySelf: 'start', textUnderlineOffset: 3 }}
        >
          Olvidé mi contraseña
        </Link>
      </Box>
    </>
  )
}
