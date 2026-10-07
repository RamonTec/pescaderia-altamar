'use client'

import * as React from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import Collapse from '@mui/material/Collapse'
import { useTheme } from '@mui/material/styles'
import { RifCiField } from '@/components/atoms/RifCiField'
import { PhoneField } from '@/components/atoms/PhoneField'
import { RepresentantesLegalesFieldArray } from '@/components/molecules/RepresentantesLegalesFieldArray'
import type { ProveedorFormValues } from '@/lib/proveedorValidation'

/**
 * Paso 1 del formulario de proveedor: identificación y contacto.
 * Toggle de tipo de persona; en jurídica aparece la sub-sección de
 * representantes (reutiliza RepresentantesLegalesFieldArray).
 */
export function ProveedorIdentificacionFields() {
  const theme = useTheme()
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProveedorFormValues>()

  const tipoPersona = useWatch({ control, name: 'tipo_persona' })
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
            label={tipoPersona === 'juridica' ? 'Razón social *' : 'Nombre *'}
            fullWidth
            size="small"
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
                label={`${rifLabel} *`}
                size="small"
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
            fullWidth
            size="small"
            error={!!errors.email}
            helperText={errors.email?.message}
            {...register('email')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Dirección"
            fullWidth
            size="small"
            error={!!errors.direccion}
            helperText={errors.direccion?.message}
            {...register('direccion')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Contacto"
            fullWidth
            size="small"
            error={!!errors.contacto_nombre}
            helperText={errors.contacto_nombre?.message}
            {...register('contacto_nombre')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="contacto_telefono"
            control={control}
            render={({ field }) => (
              <PhoneField
                label="Teléfono de contacto"
                size="small"
                fullWidth
                value={field.value}
                onChange={field.onChange}
                disabled={field.disabled}
                error={!!errors.contacto_telefono}
                helperText={errors.contacto_telefono?.message}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Notas"
            fullWidth
            size="small"
            multiline
            minRows={2}
            error={!!errors.notas}
            helperText={errors.notas?.message}
            {...register('notas')}
          />
        </Grid>
      </Grid>

      <Collapse in={tipoPersona === 'juridica'} timeout={theme.transitions.duration.standard}>
        <Box sx={{ mt: tipoPersona === 'juridica' ? 1 : 0 }}>
          <RepresentantesLegalesFieldArray />
        </Box>
      </Collapse>
    </Box>
  )
}
