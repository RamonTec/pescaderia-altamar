'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { AppDialog } from '@/components/organisms/AppDialog'
import { NumberField } from '@/components/atoms/NumberField'
import { RifCiField } from '@/components/atoms/RifCiField'
import { empleadoSchema, type EmpleadoFormInput, type EmpleadoFormValues } from '@/lib/empleadoValidation'
import { useNotify } from '@/lib/useNotify'
import { guardarEmpleadoAction } from '@/app/(protected)/gastos/empleados/[id]/actions'
import type { Empleado } from '@/types/domain'

export interface EmpleadoFormProps {
  open: boolean
  /** Empleado a editar; `null` = nuevo. */
  empleado: Empleado | null
  onClose: () => void
}

const CAMPOS = ['nombre', 'cedula', 'cargo', 'salario_base', 'moneda', 'notas'] as const

/**
 * Alta o edición de un empleado (20-gastos, Fase B), `AppDialog sm`:
 * nombre, cédula (`RifCiField`, `V-`/`E-`), cargo, salario base MENSUAL
 * (P3) con su moneda y notas. Cambiar el salario no toca pagos hechos.
 * Montar con `key` para que tome los valores iniciales al abrir.
 */
export function EmpleadoForm({ open, empleado, onClose }: EmpleadoFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const { control, register, handleSubmit, setError, formState } = useForm<
    EmpleadoFormInput,
    unknown,
    EmpleadoFormValues
  >({
    resolver: zodResolver(empleadoSchema),
    defaultValues: {
      id: empleado?.id ?? '',
      nombre: empleado?.nombre ?? '',
      cedula: empleado?.cedula ?? '',
      cargo: empleado?.cargo ?? '',
      salario_base: empleado?.salario_base ?? null,
      moneda: empleado?.moneda ?? 'usd',
      notas: empleado?.notas ?? '',
    },
    disabled: isPending,
  })
  const moneda = useWatch({ control, name: 'moneda' })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const result = await guardarEmpleadoAction(values)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          const c = CAMPOS.find((k) => k === campo)
          if (c) setError(c, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Empleado guardado')
      onClose()
    })
  })

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="sm"
      title={empleado ? 'Editar empleado' : 'Nuevo empleado'}
      subtitle="Recibe pagos de nómina. El salario es mensual: la quincena precarga la mitad."
      onSubmit={(e) => {
        onSubmit(e)
      }}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending}>
          {empleado ? 'Guardar cambios' : 'Registrar empleado'}
        </Button>
      }
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 7 }}>
          <TextField
            label="Nombre *"
            fullWidth
            size="small"
            {...register('nombre')}
            error={!!formState.errors.nombre}
            helperText={formState.errors.nombre?.message}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <Controller
            control={control}
            name="cedula"
            render={({ field }) => (
              <RifCiField
                label="Cédula *"
                fullWidth
                size="small"
                placeholder="V-12345678"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                disabled={formState.disabled}
                error={!!formState.errors.cedula}
                helperText={formState.errors.cedula?.message}
              />
            )}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Cargo"
            fullWidth
            size="small"
            {...register('cargo')}
            error={!!formState.errors.cargo}
            helperText={formState.errors.cargo?.message}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <Controller
            control={control}
            name="moneda"
            render={({ field }) => (
              <ToggleButtonGroup
                exclusive
                size="small"
                fullWidth
                value={field.value}
                disabled={formState.disabled}
                onChange={(_, next: 'usd' | 'bs' | null) => {
                  if (next) field.onChange(next)
                }}
                aria-label="Moneda del salario"
              >
                <ToggleButton value="usd">En USD</ToggleButton>
                <ToggleButton value="bs">En Bs</ToggleButton>
              </ToggleButtonGroup>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 7 }}>
          <Controller
            control={control}
            name="salario_base"
            render={({ field }) => (
              <NumberField
                label={`Salario base mensual (${moneda === 'usd' ? 'USD' : 'Bs'}) *`}
                fullWidth
                size="small"
                decimals={2}
                prefix={moneda === 'usd' ? '$' : 'Bs'}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                disabled={formState.disabled}
                error={!!formState.errors.salario_base}
                helperText={formState.errors.salario_base?.message}
              />
            )}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            label="Notas"
            fullWidth
            size="small"
            multiline
            minRows={2}
            {...register('notas')}
            error={!!formState.errors.notas}
            helperText={formState.errors.notas?.message}
          />
        </Grid>
      </Grid>
    </AppDialog>
  )
}
