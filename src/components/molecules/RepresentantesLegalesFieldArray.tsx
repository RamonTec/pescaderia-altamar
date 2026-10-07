'use client'

import * as React from 'react'
import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { RifCiField } from '@/components/atoms/RifCiField'
import type { ClienteFormValues } from '@/lib/clienteValidation'

/**
 * Lista editable de representantes legales (solo visible si
 * tipo_persona === 'juridica'). Usa useFieldArray.
 */
export function RepresentantesLegalesFieldArray() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ClienteFormValues>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'representantes',
  })

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Representantes legales</Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => append({ nombre: '', cedula: '', cargo: '', telefono: '' })}
        >
          Agregar
        </Button>
      </Box>

      {fields.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sin representantes. Agrega al menos uno.
        </Typography>
      ) : (
        fields.map((field, index) => (
          <Box
            key={field.id}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 2,
              display: 'grid',
              gap: 1,
            }}
          >
            <Grid container spacing={2} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  label="Nombre"
                  fullWidth
                  size="small"
                  error={!!errors.representantes?.[index]?.nombre}
                  helperText={errors.representantes?.[index]?.nombre?.message}
                  {...register(`representantes.${index}.nombre`)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Controller
                  control={control}
                  name={`representantes.${index}.cedula`}
                  render={({ field: cedulaField }) => (
                    <RifCiField
                      label="Cédula"
                      fullWidth
                      size="small"
                      value={cedulaField.value}
                      onChange={cedulaField.onChange}
                      error={!!errors.representantes?.[index]?.cedula}
                      helperText={errors.representantes?.[index]?.cedula?.message}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  label="Cargo"
                  fullWidth
                  size="small"
                  error={!!errors.representantes?.[index]?.cargo}
                  helperText={errors.representantes?.[index]?.cargo?.message}
                  {...register(`representantes.${index}.cargo`)}
                />
              </Grid>
              <Grid size={{ xs: 10, sm: 3 }}>
                <TextField
                  label="Teléfono"
                  fullWidth
                  size="small"
                  error={!!errors.representantes?.[index]?.telefono}
                  helperText={errors.representantes?.[index]?.telefono?.message}
                  {...register(`representantes.${index}.telefono`)}
                />
              </Grid>
              <Grid size={{ xs: 2, sm: 2 }}>
                <IconButton
                  aria-label="Quitar representante"
                  color="error"
                  onClick={() => remove(index)}
                >
                  <DeleteOutlinedIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Box>
        ))
      )}
    </Box>
  )
}
