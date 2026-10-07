'use client'

import * as React from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { RifCiField } from '@/components/atoms/RifCiField'
import { NumberField } from '@/components/atoms/NumberField'
import type { ClienteFormValues } from '@/lib/clienteValidation'

function Seccion({
  titulo,
  ayuda,
  children,
}: {
  titulo: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0, display: 'grid', gap: 2 }}>
      <Box component="legend" sx={{ p: 0, mb: ayuda ? 0.25 : 0 }}>
        <Typography variant="h6" component="span">
          {titulo}
        </Typography>
      </Box>
      {ayuda ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1.5 }}>
          {ayuda}
        </Typography>
      ) : null}
      {children}
    </Box>
  )
}

/**
 * Campos base del formulario de cliente, agrupados en Identificación,
 * Contacto y Crédito. Usa FormProvider (useFormContext), por lo que debe
 * estar dentro de un <FormProvider> montado por el organismo ClienteForm.
 */
export function ClienteFormFields() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ClienteFormValues>()

  const tipoPersona = useWatch({ control, name: 'tipo_persona' })
  const juridica = tipoPersona === 'juridica'

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <Seccion titulo="Identificación">
        <Controller
          name="tipo_persona"
          control={control}
          render={({ field }) => (
            <ToggleButtonGroup
              exclusive
              value={field.value}
              onChange={(_, next) => next && field.onChange(next)}
              disabled={field.disabled}
              size="small"
              aria-label="Tipo de persona"
            >
              <ToggleButton value="natural">Persona natural</ToggleButton>
              <ToggleButton value="juridica">Persona jurídica</ToggleButton>
            </ToggleButtonGroup>
          )}
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 7 }}>
            <TextField
              label={juridica ? 'Razón social *' : 'Nombre y apellido *'}
              fullWidth
              error={!!errors.nombre}
              helperText={errors.nombre?.message}
              {...register('nombre')}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <Controller
              name="rif_ci"
              control={control}
              render={({ field }) => (
                <RifCiField
                  label={juridica ? 'RIF *' : 'Cédula o RIF *'}
                  placeholder={juridica ? 'J-123456789' : 'V-12345678'}
                  fullWidth
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  disabled={field.disabled}
                  error={!!errors.rif_ci}
                  helperText={errors.rif_ci?.message}
                />
              )}
            />
          </Grid>
        </Grid>
      </Seccion>

      <Seccion titulo="Contacto">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Teléfono"
              placeholder="0414-1234567"
              type="tel"
              fullWidth
              error={!!errors.telefono}
              helperText={errors.telefono?.message}
              {...register('telefono')}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register('email')}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Dirección"
              fullWidth
              error={!!errors.direccion}
              helperText={errors.direccion?.message}
              {...register('direccion')}
            />
          </Grid>
        </Grid>
      </Seccion>

      <Seccion titulo="Crédito" ayuda="Déjalo vacío si el cliente solo compra de contado.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="limite_credito_usd"
              control={control}
              render={({ field }) => (
                <NumberField
                  label="Límite de crédito (USD)"
                  prefix="$"
                  fullWidth
                  value={field.value}
                  onChange={field.onChange}
                  disabled={field.disabled}
                  error={!!errors.limite_credito_usd}
                  helperText={errors.limite_credito_usd?.message}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Notas"
              placeholder="Horario de entrega, preferencias de corte…"
              fullWidth
              multiline
              minRows={2}
              error={!!errors.notas}
              helperText={errors.notas?.message}
              {...register('notas')}
            />
          </Grid>
        </Grid>
      </Seccion>
    </Box>
  )
}
