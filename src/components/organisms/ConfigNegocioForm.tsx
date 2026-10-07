'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useForm, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import { configFormSchema, type ConfigFormValues } from '@/lib/configValidation'
import { NumberField } from '@/components/atoms/NumberField'
import { RifCiField } from '@/components/atoms/RifCiField'
import { PhoneField } from '@/components/atoms/PhoneField'
import { FormSection } from '@/components/molecules/FormSection'
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
    dias_alerta_lote: c?.dias_alerta_lote ?? null,
    // 08-tasas: default de la migración (10 %) si la fila no lo trae.
    umbral_desviacion_tasa_pct: c?.umbral_desviacion_tasa_pct ?? 10,
    // 09-cuentas-por-cobrar: defaults de la migración si la fila no los trae.
    dias_credito_default: c?.dias_credito_default ?? 15,
    dias_aviso_por_vencer: c?.dias_aviso_por_vencer ?? 3,
    nombre_comercial: c?.nombre_comercial ?? 'Altamar Sea Food',
    email_respuesta: c?.email_respuesta ?? '',
    instrucciones_pago: c?.instrucciones_pago ?? '',
    // 06-contratos: datos del negocio para el encabezado de los contratos.
    razon_social: c?.razon_social ?? '',
    rif: c?.rif ?? '',
    direccion: c?.direccion ?? '',
    telefono: c?.telefono ?? '',
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
    disabled: isPending,
  })

  const { handleSubmit, register, reset, setError, formState, control } = methods

  const ivaPct = useWatch({ control, name: 'iva_pct' })
  const umbralKg = useWatch({ control, name: 'umbral_stock_bajo_kg' })
  const diasAlertaLote = useWatch({ control, name: 'dias_alerta_lote' })
  const umbralTasa = useWatch({ control, name: 'umbral_desviacion_tasa_pct' })
  const diasCredito = useWatch({ control, name: 'dias_credito_default' })
  const diasAviso = useWatch({ control, name: 'dias_aviso_por_vencer' })
  const instrucciones = useWatch({ control, name: 'instrucciones_pago' })

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
          <FormSection
            titulo="Configuración del negocio"
            ayuda="IVA por defecto, fuente de tasa preferida, umbrales, vencimiento de las ventas a crédito y datos de los recordatorios de cobro."
            primera
          >
          <NumberField
            label="IVA por defecto (%) *"
            fullWidth
            size="small"
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
            size="small"
          >
            <MenuItem value="bcv">BCV (oficial)</MenuItem>
            <MenuItem value="paralela">Paralela</MenuItem>
          </TextField>

          <NumberField
            label="Umbral de stock bajo (kg)"
            fullWidth
            size="small"
            decimals={3}
            suffix="kg"
            value={umbralKg}
            onChange={(v) => methods.setValue('umbral_stock_bajo_kg', v, { shouldDirty: true })}
            error={!!formState.errors.umbral_stock_bajo_kg}
            helperText={formState.errors.umbral_stock_bajo_kg?.message}
          />

          <NumberField
            label="Días para marcar un lote como antiguo"
            fullWidth
            size="small"
            decimals={0}
            suffix="días"
            value={diasAlertaLote}
            onChange={(v) =>
              methods.setValue('dias_alerta_lote', v == null ? null : Math.round(v), { shouldDirty: true })
            }
            error={!!formState.errors.dias_alerta_lote}
            helperText={
              formState.errors.dias_alerta_lote?.message ??
              'Opcional. Pescado fresco: los lotes abiertos con más días se destacan en inventario.'
            }
          />

          <NumberField
            label="Umbral de desviación de tasa (%) *"
            fullWidth
            size="small"
            decimals={2}
            suffix="%"
            value={umbralTasa}
            onChange={(v) => methods.setValue('umbral_desviacion_tasa_pct', v ?? 0, { shouldDirty: true })}
            error={!!formState.errors.umbral_desviacion_tasa_pct}
            helperText={
              formState.errors.umbral_desviacion_tasa_pct?.message ??
              'Si una tasa manual difiere más que esto de la referencial, se pide confirmación antes de guardar.'
            }
          />
          </FormSection>

          <FormSection
            titulo="Cuentas por cobrar"
            ayuda="Vencimiento de las ventas a crédito y datos que salen en los recordatorios de cobro."
          >

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <NumberField
              label="Días de crédito por defecto *"
              fullWidth
              size="small"
              decimals={0}
              suffix="días"
              value={diasCredito}
              onChange={(v) => methods.setValue('dias_credito_default', v ?? 0, { shouldDirty: true })}
              error={!!formState.errors.dias_credito_default}
              helperText={
                formState.errors.dias_credito_default?.message ??
                'Para clientes sin días propios.'
              }
            />
            <NumberField
              label="Aviso «por vencer» (días) *"
              fullWidth
              size="small"
              decimals={0}
              suffix="días"
              value={diasAviso}
              onChange={(v) => methods.setValue('dias_aviso_por_vencer', v ?? 0, { shouldDirty: true })}
              error={!!formState.errors.dias_aviso_por_vencer}
              helperText={
                formState.errors.dias_aviso_por_vencer?.message ??
                'Una factura pasa a "por vencer" cuando le quedan estos días o menos.'
              }
            />
          </Box>

          <TextField
            label="Nombre comercial *"
            fullWidth
            size="small"
            {...register('nombre_comercial')}
            error={!!formState.errors.nombre_comercial}
            helperText={formState.errors.nombre_comercial?.message ?? 'Encabezado de los recordatorios.'}
          />

          <TextField
            label="Correo de respuesta"
            type="email"
            fullWidth
            size="small"
            {...register('email_respuesta')}
            error={!!formState.errors.email_respuesta}
            helperText={
              formState.errors.email_respuesta?.message ??
              'Las respuestas a los correos de cobranza llegan aquí.'
            }
          />

          <TextField
            label="Instrucciones de pago"
            fullWidth
            size="small"
            multiline
            minRows={4}
            placeholder={'Pago Móvil: 0412-0000000 · V-12345678 · Banco …\nZelle: pagos@…'}
            {...register('instrucciones_pago')}
            error={!!formState.errors.instrucciones_pago}
            helperText={
              formState.errors.instrucciones_pago?.message ??
              'Se incluyen al final de cada recordatorio.'
            }
          />

          {instrucciones?.trim() ? (
            <Box
              aria-label="Vista previa de las instrucciones en el mensaje"
              sx={{ p: 2, borderRadius: '8px', border: 1, borderColor: 'divider', bgcolor: 'background.default' }}
            >
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                Así sale en el mensaje
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                {`Datos de pago:\n${instrucciones.trim()}`}
              </Typography>
            </Box>
          ) : null}
          </FormSection>

          <FormSection
            titulo="Datos del negocio para contratos"
            ayuda="Obligatorios para generar contratos. Salen en el encabezado y en las firmas del PDF."
          >
          <TextField
            label="Razón social"
            fullWidth
            size="small"
            {...register('razon_social')}
            error={!!formState.errors.razon_social}
            helperText={formState.errors.razon_social?.message}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Controller
              name="rif"
              control={control}
              render={({ field }) => (
                <RifCiField
                  label="RIF"
                  size="small"
                  fullWidth
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  disabled={field.disabled}
                  error={!!formState.errors.rif}
                  helperText={formState.errors.rif?.message}
                />
              )}
            />
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
                  error={!!formState.errors.telefono}
                  helperText={formState.errors.telefono?.message}
                />
              )}
            />
          </Box>

          <TextField
            label="Dirección"
            fullWidth
            size="small"
            multiline
            minRows={2}
            {...register('direccion')}
            error={!!formState.errors.direccion}
            helperText={formState.errors.direccion?.message}
          />
          </FormSection>

          {serverError ? <Alert severity="error">{serverError}</Alert> : null}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" loading={isPending}>
              Guardar configuración
            </Button>
          </Box>
        </Box>
      </FormProvider>
    </Paper>
  )
}
