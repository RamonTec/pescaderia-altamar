'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { productoFormSchema, type ProductoFormValues } from '@/lib/productoValidation'
import type { Producto } from '@/types/domain'
import { upsertProductoAction } from '@/app/(protected)/catalogos/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface ProductoFormProps {
  open: boolean
  producto: Producto | null
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
  }
}

function toFormValues(p: Producto): ProductoFormValues {
  return {
    nombre: p.nombre,
    tipo: p.tipo,
    categoria: p.categoria ?? '',
    codigo: p.codigo ?? '',
    controla_stock: p.controla_stock,
  }
}

export function ProductoForm({ open, producto, onClose }: ProductoFormProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<ProductoFormValues>({
    resolver: zodResolver(productoFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(),
  })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState,
    setValue,
    control,
  } = methods

  const controlaStock = useWatch({ control, name: 'controla_stock' })

  React.useEffect(() => {
    if (!open) return
    reset(producto ? toFormValues(producto) : vacio())
  }, [open, producto, reset])

  const pedirCierre = async () => {
    if (formState.isDirty) {
      const ok = await confirm({
        title: '¿Descartar cambios?',
        message: 'Hay cambios sin guardar. ¿Descartarlos?',
        confirmLabel: 'Descartar',
        destructive: true,
      })
      if (!ok) return
    }
    onClose()
  }

  const aplicarErroresDeServidor = (fieldErrors: Record<string, string>) => {
    for (const [campo, mensaje] of Object.entries(fieldErrors)) {
      // @ts-expect-error setError con path dinámico
      setError(campo, { type: 'server', message: mensaje })
    }
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    const formData = new FormData()
    if (producto) formData.set('id', producto.id)
    formData.set('payload', JSON.stringify(values))

    startTransition(async () => {
      const result = await upsertProductoAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        if (result.fieldErrors) aplicarErroresDeServidor(result.fieldErrors)
        return
      }
      notify.success(result.success ?? 'Guardado')
      onClose()
    })
  })

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : pedirCierre}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <DialogTitle>{producto ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>

          <DialogContent dividers>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField
                label="Nombre *"
                {...register('nombre')}
                error={!!formState.errors.nombre}
                helperText={formState.errors.nombre?.message}
                fullWidth
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  select
                  label="Tipo *"
                  {...register('tipo')}
                  fullWidth
                >
                  <MenuItem value="crudo">Crudo</MenuItem>
                  <MenuItem value="procesado">Procesado</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Categoría"
                  {...register('categoria')}
                  fullWidth
                >
                  <MenuItem value="">Sin categoría</MenuItem>
                  {CATEGORIAS.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <TextField
                label="Código"
                {...register('codigo')}
                error={!!formState.errors.codigo}
                helperText={formState.errors.codigo?.message}
                fullWidth
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

              {serverError ? <Alert severity="error">{serverError}</Alert> : null}
            </Box>
          </DialogContent>

          <DialogActions>
            <Button onClick={pedirCierre} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isPending}
              startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Guardar
            </Button>
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  )
}
