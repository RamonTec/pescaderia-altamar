'use client'

import * as React from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { FormSection } from '@/components/molecules/FormSection'
import { RifCiField } from '@/components/atoms/RifCiField'
import { PhoneField } from '@/components/atoms/PhoneField'
import { NumberField } from '@/components/atoms/NumberField'
import type { ClienteFormValues } from '@/lib/clienteValidation'

/**
 * Campos base del formulario de cliente, agrupados en Identificación,
 * Contacto y Crédito con `FormSection` (spec 00 § Estructura visual) e
 * inputs `size="small"`. Usa FormProvider (useFormContext), por lo que debe
 * estar dentro de un <FormProvider> montado por el organismo ClienteForm.
 */
export function ClienteFormFields({ diasCreditoDefault = 15 }: { diasCreditoDefault?: number } = {}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ClienteFormValues>()

  const tipoPersona = useWatch({ control, name: 'tipo_persona' })
  const juridica = tipoPersona === 'juridica'

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <FormSection titulo="Identificación" primera>
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
              size="small"
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
                  size="small"
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
      </FormSection>

      <FormSection titulo="Contacto">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="telefono"
              control={control}
              render={({ field }) => (
                <PhoneField
                  label="Teléfono"
                  size="small"
                  fullWidth
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  disabled={field.disabled}
                  error={!!errors.telefono}
                  helperText={errors.telefono?.message}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Email"
              type="email"
              size="small"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register('email')}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Dirección"
              size="small"
              fullWidth
              error={!!errors.direccion}
              helperText={errors.direccion?.message}
              {...register('direccion')}
            />
          </Grid>
        </Grid>
      </FormSection>

      <FormSection titulo="Crédito" ayuda="Déjalo vacío si el cliente solo compra de contado.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="limite_credito_usd"
              control={control}
              render={({ field }) => (
                <NumberField
                  label="Límite de crédito (USD)"
                  prefix="$"
                  size="small"
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
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="dias_credito"
              control={control}
              render={({ field }) => (
                <NumberField
                  label="Días de crédito"
                  placeholder={`Por defecto: ${diasCreditoDefault}`}
                  suffix="días"
                  decimals={0}
                  size="small"
                  fullWidth
                  value={field.value}
                  onChange={field.onChange}
                  disabled={field.disabled}
                  error={!!errors.dias_credito}
                  helperText={
                    errors.dias_credito?.message ??
                    'Se precargan al vender a crédito; se pueden cambiar en cada venta.'
                  }
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Notas"
              placeholder="Horario de entrega, preferencias de corte…"
              size="small"
              fullWidth
              multiline
              minRows={2}
              error={!!errors.notas}
              helperText={errors.notas?.message}
              {...register('notas')}
            />
          </Grid>
        </Grid>
      </FormSection>
    </Box>
  )
}