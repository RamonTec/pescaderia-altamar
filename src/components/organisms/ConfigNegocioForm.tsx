'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import { configFormSchema, type ConfigFormValues } from '@/lib/configValidation'
import { NumberField } from '@/components/atoms/NumberField'
import type { ConfigNegocio } from '@/types/domain'
import { updateConfigAction } from '@/app/(protected)/catalogos/actions'
import { useNotify } from '@/lib/useNotify'

export interface ConfigNegocioFormProps {
  config: ConfigNegocio | null
}

function toFormValues(c: ConfigNegocio | null): ConfigFormValues {
  return {
    iva_pct: c?.iva_pct ?? 16,
    fuente_tasa_default: c?.fuente_tasa_default ?? 'bcv',
    umbral_stock_bajo_kg: c?.umbral_stock_bajo_kg ?? null,
  }
}

export function ConfigNegocioForm({ config }: ConfigNegocioFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    mode: 'onSubmit',
    defaultValues: toFormValues(config),
  })

  const { handleSubmit, register, reset, setError, formState, control } = methods

  const ivaPct = useWatch({ control, name: 'iva_pct' })
  const umbralKg = useWatch({ control, name: 'umbral_stock_bajo_kg' })

  React.useEffect(() => {
    reset(toFormValues(config))
  }, [config, reset])

  const aplicarErroresDeServidor = (fieldErrors: Record<string, string>) => {
    for (const [campo, mensaje] of Object.entries(fieldErrors)) {
      // @ts-expect-error setError con path dinámico
      setError(campo, { type: 'server', message: mensaje })
    }
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    const formData = new FormData()
    formData.set('payload', JSON.stringify(values))

    startTransition(async () => {
      const result = await updateConfigAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        if (result.fieldErrors) aplicarErroresDeServidor(result.fieldErrors)
        return
      }
      notify.success(result.success ?? 'Guardado')
    })
  })

  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 560 }}>
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2.5 }}>
          <Box>
            <Typography variant="h6">Configuración del negocio</Typography>
            <Typography variant="caption" color="text.secondary">
              IVA por defecto, fuente de tasa preferida y umbral de stock bajo.
            </Typography>
          </Box>
          <Divider />

          <NumberField
            label="IVA por defecto (%) *"
            fullWidth
            decimals={2}
            suffix="%"
            value={ivaPct}
            onChange={(v) => methods.setValue('iva_pct', v ?? 0, { shouldDirty: true })}
            error={!!formState.errors.iva_pct}
            helperText={formState.errors.iva_pct?.message}
          />

          <TextField
            select
            label="Fuente de tasa preferida"
            {...register('fuente_tasa_default')}
            fullWidth
          >
            <MenuItem value="bcv">BCV (oficial)</MenuItem>
            <MenuItem value="paralela">Paralela</MenuItem>
          </TextField>

          <NumberField
            label="Umbral de stock bajo (kg)"
            fullWidth
            decimals={3}
            suffix="kg"
            value={umbralKg}
            onChange={(v) => methods.setValue('umbral_stock_bajo_kg', v, { shouldDirty: true })}
            error={!!formState.errors.umbral_stock_bajo_kg}
            helperText={formState.errors.umbral_stock_bajo_kg?.message}
          />

          {serverError ? <Alert severity="error">{serverError}</Alert> : null}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={isPending}
              startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Guardar configuración
            </Button>
          </Box>
        </Box>
      </FormProvider>
    </Paper>
  )
}
