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
import Fade from '@mui/material/Fade'
import Link from '@mui/material/Link'
import CircularProgress from '@mui/material/CircularProgress'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'
import { recuperarAction } from '@/app/(auth)/recuperar/actions'

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu email').email('Revisa el email, falta algo'),
})

type FormValues = z.infer<typeof schema>

function BackToLogin() {
  return (
    <Link
      component={NextLink}
      href="/login"
      variant="body2"
      underline="always"
      sx={{ justifySelf: 'start', textUnderlineOffset: 3 }}
    >
      Volver a entrar
    </Link>
  )
}

export function RecuperarForm() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [sentTo, setSentTo] = React.useState<string | null>(null)

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
      const result = await recuperarAction({ error: null, success: null }, formData)
      setServerError(result.error)
      if (result.success) setSentTo(values.email)
    })
  })

  if (sentTo) {
    return (
      <Fade in>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <MarkEmailReadOutlinedIcon color="success" sx={{ fontSize: 40 }} />
          <Typography variant="h4" component="h1">
            Revisa tu correo
          </Typography>
          <Typography color="text.secondary">
            Si <Box component="strong" sx={{ color: 'text.primary', fontWeight: 500 }}>{sentTo}</Box>{' '}
            tiene una cuenta, te llegará un enlace para crear una contraseña nueva. Puede tardar
            unos minutos; revisa también la carpeta de spam.
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 1 }}>
            <BackToLogin />
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="always"
              onClick={() => setSentTo(null)}
              sx={{ textUnderlineOffset: 3 }}
            >
              Usar otro email
            </Link>
          </Box>
        </Box>
      </Fade>
    )
  }

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        Recuperar contraseña
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Te enviamos un enlace para crear una contraseña nueva.
      </Typography>

      <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2.5 }}>
        <TextField
          label="Email de tu cuenta"
          type="email"
          fullWidth
          autoFocus
          autoComplete="email"
          error={!!errors.email}
          helperText={errors.email?.message}
          {...register('email')}
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
          {isPending ? 'Enviando enlace…' : 'Enviar enlace'}
        </Button>

        <BackToLogin />
      </Box>
    </>
  )
}
