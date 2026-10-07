'use client'

import * as React from 'react'
import { Controller, useFieldArray, useFormContext } from 'react-hook-form'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { RifCiField } from '@/components/atoms/RifCiField'
import type { RepresentanteFormValues } from '@/lib/clienteValidation'

interface FormValuesConRepresentantes {
  representantes: RepresentanteFormValues[]
}

/**
 * Lista editable de representantes legales (solo visible si
 * tipo_persona === 'juridica'). Usa useFieldArray. Tipado genérico contra
 * `{ representantes: RepresentanteFormValues[] }`, de modo que sirve tanto
 * para clientes como para proveedores.
 */
export function RepresentantesLegalesFieldArray() {
  const {
    register,
    control,
    formState: { errors, disabled },
  } = useFormContext<FormValuesConRepresentantes>()

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
          startIcon={<AddOutlinedIcon />}
          disabled={disabled}
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
          <Collapse key={field.id} in timeout={300}>
            <Box
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
                    label="Nombre *"
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
                        label="Cédula *"
                        fullWidth
                        size="small"
                        value={cedulaField.value}
                        onChange={cedulaField.onChange}
                        disabled={cedulaField.disabled}
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
                    disabled={disabled}
                    onClick={() => remove(index)}
                  >
                    <DeleteOutlinedIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        ))
      )}
    </Box>
  )
}
