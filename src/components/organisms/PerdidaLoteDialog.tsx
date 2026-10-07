'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { AppDialog } from '@/components/organisms/AppDialog'
import {
  ETIQUETA_MOTIVO,
  MOTIVOS_PERDIDA,
  perdidaLoteFormSchema,
  type PerdidaLoteFormInput,
  type PerdidaLoteFormValues,
} from '@/lib/loteValidation'
import { formatKg } from '@/lib/format'
import type { Lote } from '@/types/domain'
import type { ActionState } from '@/lib/actionState'
import { useNotify } from '@/lib/useNotify'

export interface PerdidaLoteDialogProps {
  /** Lote donde se registra la pérdida; `null` cierra el diálogo. */
  lote: Lote | null
  onClose: () => void
  /** Server Action de registro (`registrarPerdidaAction`). */
  onRegistrar: (values: PerdidaLoteFormValues) => Promise<ActionState>
  /** Tras registrar con éxito (la ficha refresca). */
  onRegistrada?: () => void
}

/**
 * Pérdida en un lote fuera del procesamiento (07-lotes): kg (≤ stock del
 * lote), motivo obligatorio y detalle (obligatorio si el motivo es "Otro").
 * Cualquier usuario la registra. `AppDialog sm`: mientras guarda no se cierra
 * y con datos escritos cerrar pide confirmación.
 */
export function PerdidaLoteDialog({ lote, onClose, onRegistrar, onRegistrada }: PerdidaLoteDialogProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const enviandoRef = React.useRef(false)

  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    PerdidaLoteFormInput,
    unknown,
    PerdidaLoteFormValues
  >({
    resolver: zodResolver(perdidaLoteFormSchema),
    mode: 'onSubmit',
    disabled: isPending,
    values: { lote_id: lote?.id ?? '', peso_kg: null, motivo: 'danado', detalle: '' },
  })
  const { errors } = formState

  const enviar = (values: PerdidaLoteFormValues) => {
    if (enviandoRef.current || !lote) return
    if (values.peso_kg > lote.stock_kg + 0.0005) {
      setError('peso_kg', { type: 'manual', message: `El lote solo tiene ${formatKg(lote.stock_kg)}` })
      return
    }
    enviandoRef.current = true
    setServerError(null)
    startTransition(async () => {
      try {
        const r = await onRegistrar(values)
        if (r.error) {
          setServerError(r.fieldErrors ? null : r.error)
          for (const [campo, mensaje] of Object.entries(r.fieldErrors ?? {})) {
            setError(campo as keyof PerdidaLoteFormInput, { type: 'server', message: mensaje })
          }
          return
        }
        notify.success(r.success ?? 'Pérdida registrada')
        onRegistrada?.()
        onClose()
      } finally {
        enviandoRef.current = false
      }
    })
  }

  // `handleSubmit` dentro del handler: el ref de doble envío se lee al enviar.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit(enviar)(e)

  return (
    <AppDialog
      open={lote != null}
      onClose={onClose}
      size="sm"
      title="Registrar pérdida"
      subtitle={lote ? `Lote ${lote.codigo} · ${lote.producto_nombre} · quedan ${formatKg(lote.stock_kg)}` : undefined}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      onSubmit={onSubmit}
      primaryAction={
        <Button type="submit" variant="contained" color="error" loading={isPending}>
          Registrar pérdida
        </Button>
      }
    >
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        <Box>
          <Controller
            control={control}
            name="peso_kg"
            render={({ field }) => (
              <NumberField
                label="Kg perdidos *"
                fullWidth
                size="small"
                decimals={3}
                suffix="kg"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={field.disabled}
                error={!!errors.peso_kg}
                helperText={errors.peso_kg?.message}
              />
            )}
          />
          {lote && lote.stock_kg > 0 ? (
            <Link
              component="button"
              type="button"
              variant="caption"
              disabled={isPending}
              onClick={() => setValue('peso_kg', lote.stock_kg, { shouldDirty: true })}
            >
              Todo lo que queda ({formatKg(lote.stock_kg)})
            </Link>
          ) : null}
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
            Motivo *
          </Typography>
          <Controller
            control={control}
            name="motivo"
            render={({ field }) => (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={field.value}
                onChange={(_, next) => next && field.onChange(next)}
                disabled={field.disabled}
                aria-label="Motivo de la pérdida"
                sx={{ flexWrap: 'wrap' }}
              >
                {MOTIVOS_PERDIDA.map((m) => (
                  <ToggleButton key={m} value={m}>
                    {ETIQUETA_MOTIVO[m]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          />
          {errors.motivo ? (
            <Typography variant="caption" color="error" component="p">
              {errors.motivo.message}
            </Typography>
          ) : null}
        </Box>

        <TextField
          label="Detalle"
          fullWidth
          size="small"
          multiline
          minRows={2}
          maxRows={4}
          placeholder="Ej. se rompió la cadena de frío"
          {...register('detalle')}
          error={!!errors.detalle}
          helperText={errors.detalle?.message}
        />
      </Box>
    </AppDialog>
  )
}
