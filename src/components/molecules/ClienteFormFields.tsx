'use client'

import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import { RifCiField } from '@/components/atoms/RifCiField'
import { NumberField } from '@/components/atoms/NumberField'
import type { ClienteFormValues } from '@/lib/clienteValidation'

/**
 * Campos base del formulario de cliente + toggle de tipo de persona.
 * Usa FormProvider (useFormContext), por lo que debe estar dentro de un
 * <FormProvider> montado por el organismo ClienteForm.
 */
export function ClienteFormFields() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<ClienteFormValues>()

  const tipoPersona = watch('tipo_persona')
  const rifLabel = tipoPersona === 'juridica' ? 'RIF' : 'Cédula'

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <FormControl component="fieldset">
        <FormLabel component="legend" sx={{ mb: 1 }}>
          Tipo de persona
        </FormLabel>
        <Controller
          name="tipo_persona"
          control={control}
          render={({ field }) => (
            <ToggleButtonGroup
              exclusive
              value={field.value}
              onChange={(_, next) => next && field.onChange(next)}
              size="small"
            >
              <ToggleButton value="natural">Natural</ToggleButton>
              <ToggleButton value="juridica">Jurídica</ToggleButton>
            </ToggleButtonGroup>
          )}
        />
      </FormControl>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label={tipoPersona === 'juridica' ? 'Razón social' : 'Nombre'}
            fullWidth
            error={!!errors.nombre}
            helperText={errors.nombre?.message}
            {...register('nombre')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="rif_ci"
            control={control}
            render={({ field }) => (
              <RifCiField
                label={rifLabel}
                fullWidth
                value={field.value}
                onChange={field.onChange}
                error={!!errors.rif_ci}
                helperText={errors.rif_ci?.message}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Teléfono"
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
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Dirección"
            fullWidth
            error={!!errors.direccion}
            helperText={errors.direccion?.message}
            {...register('direccion')}
          />
        </Grid>
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
                error={!!errors.limite_credito_usd}
                helperText={errors.limite_credito_usd?.message}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Notas"
            fullWidth
            multiline
            minRows={2}
            error={!!errors.notas}
            helperText={errors.notas?.message}
            {...register('notas')}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
