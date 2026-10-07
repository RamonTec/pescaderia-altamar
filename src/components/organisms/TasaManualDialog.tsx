'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useWatch, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { AppDialog } from '@/components/organisms/AppDialog'
import { fechaHoy, formatTasa } from '@/lib/format'
import { registrarTasaManualAction } from '@/app/(protected)/tasas/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'
import { desviacionPct } from '@/lib/tasaValidation'

/**
 * Valores de la referencial visible en la pantalla (para el aviso de
 * desviación del diálogo): la de la tarjeta correspondiente.
 */
export interface TasaManualDialogProps {
  open: boolean
  onClose: () => void
  /** Valor referencial actual de la fuente/moneda elegida, si existe. */
  referencialActual: number | null
}

const tasaManualSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha valor inválida'),
  fuente: z.enum(['bcv', 'paralela']),
  moneda: z.enum(['USD', 'EUR']),
  valor: z
    .number({ message: 'Valor requerido' })
    .positive('La tasa debe ser mayor a 0')
    .nullable()
    .refine((v) => v !== null, 'Valor requerido'),
})

type TasaManualInput = z.input<typeof tasaManualSchema>

/**
 * Registrar o corregir la tasa manual del día (admin, 08-tasas): corrige una
 * fecha valor si el BCV no publicó o la fuente falló. Si el valor difiere
 * más de 20 % de la referencial actual visible, pide confirmación.
 */
export function TasaManualDialog({ open, onClose, referencialActual }: TasaManualDialogProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const { control, handleSubmit, setError, reset, formState } = useForm<TasaManualInput>({
    resolver: zodResolver(tasaManualSchema),
    mode: 'onSubmit',
    defaultValues: { fecha: fechaHoy(), fuente: 'bcv', moneda: 'USD', valor: null },
  })
  const valor = useWatch({ control, name: 'valor' })

  React.useEffect(() => {
    if (open) reset({ fecha: fechaHoy(), fuente: 'bcv', moneda: 'USD', valor: null })
  }, [open, reset])

  const onSubmit = handleSubmit(async (values) => {
    // Aviso de desviación contra la referencial visible (sanidad del spec).
    const desviacion = desviacionPct(values.valor ?? 0, referencialActual)
    if (desviacion != null && Math.abs(desviacion) > 20) {
      const ok = await confirm({
        title: 'Confirmar tasa manual',
        message: `El valor difiere ${Math.abs(desviacion).toFixed(1)} % de la referencial actual (${
          referencialActual != null ? formatTasa(referencialActual) : '—'
        }). ¿Confirmas?`,
        confirmLabel: 'Confirmar tasa',
      })
      if (!ok) return
    }

    setServerError(null)
    const formData = new FormData()
    formData.set('payload', JSON.stringify(values))

    startTransition(async () => {
      const result = await registrarTasaManualAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          // @ts-expect-error setError con path dinámico
          setError(campo, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Tasa manual registrada')
      onClose()
    })
  })

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Registrar tasa manual del día"
      subtitle="Corrige o completa la referencial de una fecha valor"
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      onSubmit={onSubmit}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending}>
          Registrar tasa
        </Button>
      }
    >
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          La tasa manual reemplaza a la referencial de esa fecha hasta el día
          siguiente; las operaciones ya guardadas no se recalculan.
        </Typography>

        <Controller
          control={control}
          name="fecha"
          render={({ field }) => (
            <TextField
              label="Fecha valor *"
              type="date"
              fullWidth
              {...field}
              error={!!formState.errors.fecha}
              helperText={formState.errors.fecha?.message}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
        />

        <Controller
          control={control}
          name="fuente"
          render={({ field }) => (
            <Box>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                Fuente *
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                fullWidth
                value={field.value}
                onChange={(_, next) => next && field.onChange(next)}
                aria-label="Fuente de la tasa"
              >
                <ToggleButton value="bcv">BCV</ToggleButton>
                <ToggleButton value="paralela">Paralela</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
        />

        <Controller
          control={control}
          name="moneda"
          render={({ field }) => (
            <Box>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                Moneda *
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                fullWidth
                value={field.value}
                onChange={(_, next) => next && field.onChange(next)}
                aria-label="Moneda de la tasa"
              >
                <ToggleButton value="USD">USD</ToggleButton>
                <ToggleButton value="EUR">EUR</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
        />

        <Controller
          control={control}
          name="valor"
          render={({ field }) => (
            <NumberField
              label="Valor (Bs) *"
              fullWidth
              decimals={6}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={!!formState.errors.valor}
              helperText={formState.errors.valor?.message}
            />
          )}
        />

        {referencialActual != null && valor != null ? (
          <Alert severity={Math.abs(desviacionPct(valor, referencialActual) ?? 0) > 20 ? 'warning' : 'info'}>
            {(() => {
              const d = desviacionPct(valor, referencialActual)
              return d == null
                ? null
                : `${d >= 0 ? '+' : ''}${d.toFixed(1)} % vs la referencial actual (${formatTasa(
                    referencialActual
                  )})`
            })()}
          </Alert>
        ) : null}
      </Box>
    </AppDialog>
  )
}