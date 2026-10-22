'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { AppDialog } from '@/components/organisms/AppDialog'
import { NumberField } from '@/components/atoms/NumberField'
import {
  categoriaGastoSchema,
  type CategoriaGastoFormInput,
  type CategoriaGastoFormValues,
} from '@/lib/categoriaGastoValidation'
import { useNotify } from '@/lib/useNotify'
import { guardarCategoriaGastoAction } from '@/app/(protected)/gastos/actions'
import type { CategoriaGasto } from '@/types/domain'

export interface CategoriaGastoFormProps {
  open: boolean
  /** Categoría a editar; `null` = nueva. */
  categoria: CategoriaGasto | null
  /** Padre propuesto al crear ("Nueva subcategoría"). */
  padreInicial?: string | null
  /** Árbol de categorías (primer nivel con `subcategorias`). */
  categorias: CategoriaGasto[]
  onClose: () => void
}

/**
 * Alta o edición de una categoría de gasto (20-gastos), `AppDialog xs`:
 * nombre, padre opcional (solo categorías de primer nivel; Nómina no admite
 * subcategorías) y orden. En una de sistema solo cambia el orden.
 * Montar con `key` para que tome los valores iniciales al abrir.
 */
export function CategoriaGastoForm({ open, categoria, padreInicial = null, categorias, onClose }: CategoriaGastoFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const esSistema = categoria?.es_sistema ?? false
  const tieneSubcategorias = (categorias.find((c) => c.id === categoria?.id)?.subcategorias?.length ?? 0) > 0

  const { control, register, handleSubmit, setError, formState } = useForm<
    CategoriaGastoFormInput,
    unknown,
    CategoriaGastoFormValues
  >({
    resolver: zodResolver(categoriaGastoSchema),
    defaultValues: {
      id: categoria?.id ?? '',
      nombre: categoria?.nombre ?? '',
      categoria_padre_id: categoria ? (categoria.categoria_padre_id ?? '') : (padreInicial ?? ''),
      orden: categoria?.orden ?? 0,
    },
    disabled: isPending,
  })

  // Padres posibles: primer nivel, activas o la actual, sin Nómina ni la propia.
  const padres = categorias.filter(
    (c) => c.clave !== 'nomina' && c.id !== categoria?.id && (c.activo || c.id === categoria?.categoria_padre_id)
  )

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const result = await guardarCategoriaGastoAction(values)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          if (campo === 'nombre' || campo === 'categoria_padre_id' || campo === 'orden') {
            setError(campo, { type: 'server', message: mensaje })
          }
        }
        return
      }
      notify.success(result.success ?? 'Categoría guardada')
      onClose()
    })
  })

  const titulo = categoria
    ? categoria.categoria_padre_id
      ? 'Editar subcategoría'
      : 'Editar categoría'
    : padreInicial
      ? 'Nueva subcategoría'
      : 'Nueva categoría'

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="xs"
      title={titulo}
      onSubmit={(e) => {
        onSubmit(e)
      }}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending}>
          Guardar
        </Button>
      }
    >
      <Box sx={{ display: 'grid', gap: 2 }}>
        <TextField
          label="Nombre *"
          fullWidth
          size="small"
          {...register('nombre')}
          // `readOnly` y no `disabled`: RHF no envía el valor de un input deshabilitado.
          slotProps={{ htmlInput: { readOnly: esSistema } }}
          error={!!formState.errors.nombre}
          helperText={formState.errors.nombre?.message ?? (esSistema ? 'Categoría de sistema: no se renombra.' : undefined)}
        />
        <Controller
          control={control}
          name="categoria_padre_id"
          render={({ field }) => (
            <TextField
              select
              label="Categoría padre"
              fullWidth
              size="small"
              value={field.value}
              onChange={field.onChange}
              disabled={formState.disabled || esSistema || tieneSubcategorias}
              error={!!formState.errors.categoria_padre_id}
              helperText={
                formState.errors.categoria_padre_id?.message ??
                (tieneSubcategorias ? 'Tiene subcategorías: queda en el primer nivel.' : 'Vacío = categoría de primer nivel.')
              }
            >
              <MenuItem value="">Ninguna (primer nivel)</MenuItem>
              {padres.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nombre}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          control={control}
          name="orden"
          render={({ field }) => (
            <NumberField
              label="Orden"
              fullWidth
              size="small"
              decimals={0}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={formState.disabled}
              error={!!formState.errors.orden}
              helperText={formState.errors.orden?.message ?? 'Menor primero en las listas.'}
            />
          )}
        />
      </Box>
    </AppDialog>
  )
}
