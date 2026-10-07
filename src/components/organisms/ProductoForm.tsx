'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useForm, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import { AppDialog } from '@/components/organisms/AppDialog'
import { productoFormSchema, type ProductoFormValues } from '@/lib/productoValidation'
import type { Producto } from '@/types/domain'
import { upsertProductoAction } from '@/app/(protected)/catalogos/actions'
import { useNotify } from '@/lib/useNotify'

export interface ProductoFormProps {
  open: boolean
  producto: Producto | null
  /** Crudos que pueden ser origen de un procesado. */
  crudos: Producto[]
  onClose: () => void
}

const CATEGORIAS = ['pescado', 'marisco', 'otro'] as const

function vacio(): ProductoFormValues {
  return {
    nombre: '',
    tipo: 'crudo',
    categoria: '',
    codigo: '',
    controla_stock: true,
    producto_origen_id: '',
  }
}

function toFormValues(p: Producto): ProductoFormValues {
  return {
    nombre: p.nombre,
    tipo: p.tipo,
    categoria: p.categoria ?? '',
    codigo: p.codigo ?? '',
    controla_stock: p.controla_stock,
    producto_origen_id: p.producto_origen_id ?? '',
  }
}

export function ProductoForm({ open, producto, crudos, onClose }: ProductoFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  // Copia síncrona: dos clics antes del re-render deben ver el primero.
  const submittingRef = React.useRef(false)

  const methods = useForm<ProductoFormValues>({
    resolver: zodResolver(productoFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(),
    disabled: isPending,
  })

  const { register, handleSubmit, reset, setError, formState, setValue, control } = methods

  const [controlaStock, tipo] = useWatch({ control, name: ['controla_stock', 'tipo'] })
  const origenes = crudos.filter((c) => c.id !== producto?.id)

  React.useEffect(() => {
    if (!open) return
    reset(producto ? toFormValues(producto) : vacio())
  }, [open, producto, reset])

  const aplicarErroresDeServidor = (fieldErrors: Record<string, string>) => {
    for (const [campo, mensaje] of Object.entries(fieldErrors)) {
      // @ts-expect-error setError con path dinámico
      setError(campo, { type: 'server', message: mensaje })
    }
  }

  const guardar = (values: ProductoFormValues) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setServerError(null)
    const formData = new FormData()
    if (producto) formData.set('id', producto.id)
    formData.set('payload', JSON.stringify(values))

    startTransition(async () => {
      try {
        const result = await upsertProductoAction({ error: null, success: null }, formData)
        if (result.error) {
          setServerError(result.error)
          if (result.fieldErrors) aplicarErroresDeServidor(result.fieldErrors)
          return
        }
        notify.success(result.success ?? 'Producto guardado')
        onClose()
      } finally {
        submittingRef.current = false
      }
    })
  }

  // `handleSubmit` se arma en el evento (no en el render) para que la ref
  // solo se lea al enviar.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit(guardar)(e)

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="sm"
      title={producto ? 'Editar producto' : 'Nuevo producto'}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      onSubmit={onSubmit}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending}>
          {producto ? 'Actualizar producto' : 'Guardar producto'}
        </Button>
      }
    >
      <FormProvider {...methods}>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <TextField
            label="Nombre *"
            {...register('nombre')}
            error={!!formState.errors.nombre}
            helperText={formState.errors.nombre?.message}
            fullWidth
            size="small"
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              select
              label="Tipo *"
              {...register('tipo')}
              fullWidth
              size="small"
              error={!!formState.errors.tipo}
              helperText={formState.errors.tipo?.message}
            >
              <MenuItem value="crudo">Crudo</MenuItem>
              <MenuItem value="procesado">Procesado</MenuItem>
            </TextField>
            <TextField select size="small" label="Categoría" {...register('categoria')} fullWidth>
              <MenuItem value="">Sin categoría</MenuItem>
              {CATEGORIAS.map((c) => (
                <MenuItem key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          {tipo === 'procesado' ? (
            <Controller
              control={control}
              name="producto_origen_id"
              render={({ field }) => (
                <TextField
                  select
                  label="Se obtiene de *"
                  fullWidth
                  size="small"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={!!formState.errors.producto_origen_id}
                  helperText={
                    formState.errors.producto_origen_id?.message ??
                    'Producto crudo que se limpia para obtener este procesado'
                  }
                >
                  {origenes.length === 0 ? (
                    <MenuItem value="" disabled>
                      No hay productos crudos
                    </MenuItem>
                  ) : null}
                  {origenes.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.codigo ? `${c.codigo} · ${c.nombre}` : c.nombre}
                      {c.activo ? '' : ' (inactivo)'}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          ) : null}
          <TextField
            label="Código"
            {...register('codigo')}
            error={!!formState.errors.codigo}
            helperText={formState.errors.codigo?.message}
            fullWidth
            size="small"
            placeholder="Ej. CUR-001"
          />
          <FormControlLabel
            control={
              <Switch
                checked={controlaStock}
                onChange={(e) => setValue('controla_stock', e.target.checked)}
              />
            }
            label="Controla stock"
          />
        </Box>
      </FormProvider>
    </AppDialog>
  )
}