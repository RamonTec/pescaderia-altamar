'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

import { AppDialog } from '@/components/organisms/AppDialog'
import { FormSection } from '@/components/molecules/FormSection'
import { CompraItemsFieldArray, itemVacio } from '@/components/molecules/CompraItemsFieldArray'
import {
  pedirConfirmacionTasaManual,
  TasaSelector,
  type ReferencialTasa,
  type TasaSelectorConfig,
} from '@/components/organisms/TasaSelector'
import {
  compraFormSchema,
  type CompraFormInput,
  type CompraFormValues,
} from '@/lib/compraValidation'
import { fechaHoy, formatBs, formatUsd } from '@/lib/format'
import type { LoteCreado, Producto, Proveedor } from '@/types/domain'
import { crearCompraAction } from '@/app/(protected)/compras/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

const MONO = { fontVariantNumeric: 'tabular-nums' }

export interface CompraFormProps {
  open: boolean
  onClose: () => void
  /** Proveedores activos (03-proveedores). */
  proveedores: Proveedor[]
  /** Productos crudos activos. */
  productos: Producto[]
  /** Config de tasas de `config_negocio` (08-tasas Fase D). */
  configTasas: TasaSelectorConfig
  /** Compra registrada: los lotes creados, para mostrarlos y rotular (07-lotes). */
  onCreated?: (lotes: LoteCreado[]) => void
}

function vacio(): CompraFormInput {
  return {
    proveedor_id: '',
    fecha: fechaHoy(),
    condicion: 'contado',
    moneda: 'usd',
    // 08-tasas Fase D: `TasaSelector` resuelve la referencial por fecha y
    // completa origen/fuente/valor (o exige la manual).
    tasa_origen: 'referencial',
    tasa_fuente: null,
    tasa: null,
    notas: '',
    items: [itemVacio()],
  }
}

/**
 * Registro de una compra (recepción): proveedor, condición, moneda, tasa
 * (referencial o manual, vía `TasaSelector`) e items pesados. El total se
 * recalcula en vivo en USD y Bs. Montar con un `key` que cambie al abrir:
 * así cada apertura empieza en blanco.
 */
export function CompraForm({
  open,
  onClose,
  proveedores,
  productos,
  configTasas,
  onCreated,
}: CompraFormProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<CompraFormInput, unknown, CompraFormValues>({
    resolver: zodResolver(compraFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(),
    disabled: isPending,
  })
  const { control, register, handleSubmit, setError, setValue, formState } = methods

  const [proveedorId, condicion, moneda, fecha, tasa, items] = useWatch({
    control,
    name: ['proveedor_id', 'condicion', 'moneda', 'fecha', 'tasa', 'items'],
  })
  const proveedor = proveedores.find((p) => p.id === proveedorId) ?? null

  // Referencial vigente que el `TasaSelector` reporta: se usa para la
  // confirmación del umbral al enviar (patrón de 08-tasas).
  const [referencial, setReferencial] = React.useState<ReferencialTasa | null>(null)

  const totalMoneda = (items ?? []).reduce(
    (s, i) => s + (i.peso_kg != null && i.costo_kg != null ? i.peso_kg * i.costo_kg : 0),
    0
  )
  const totalKg = (items ?? []).reduce((s, i) => s + (i.peso_kg ?? 0), 0)
  const tasaValida = tasa != null && tasa > 0
  const totalUsd = moneda === 'usd' ? totalMoneda : tasaValida ? totalMoneda / tasa : null
  const totalBs = moneda === 'bs' ? totalMoneda : tasaValida ? totalMoneda * tasa : null

  const pedirCierre = async () => {
    if (formState.isDirty) {
      const ok = await confirm({
        title: '¿Descartar la compra?',
        message: 'Hay datos sin guardar. ¿Descartarlos?',
        confirmLabel: 'Descartar',
        destructive: true,
      })
      if (!ok) return
    }
    onClose()
  }

  const confirmarTasaSiExcede = (values: CompraFormValues): Promise<boolean> =>
    pedirConfirmacionTasaManual(confirm, values, referencial, configTasas.umbral_desviacion_tasa_pct)

  const onSubmit = handleSubmit(async (values) => {
    if (!(await confirmarTasaSiExcede(values))) return
    setServerError(null)
    const formData = new FormData()
    formData.set('payload', JSON.stringify(values))

    startTransition(async () => {
      const result = await crearCompraAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          // @ts-expect-error setError con path dinámico
          setError(campo, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Compra registrada')
      if (result.info) notify.info(result.info)
      onClose()
      onCreated?.(result.lotes ?? [])
    })
  })

  return (
    <AppDialog
      open={open}
      onClose={pedirCierre}
      size="md"
      title="Nueva compra"
      onSubmit={(e) => {
        // useForm.handleSubmit manages preventDefault
        onSubmit(e)
      }}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      primaryAction={
        <Button
          type="submit"
          variant="contained"
          disabled={productos.length === 0}
          loading={isPending}
        >
          Registrar compra
        </Button>
      }
    >
      <FormProvider {...methods}>
        <Box sx={{ display: 'grid', gap: 3 }}>
          <FormSection titulo="Proveedor y fecha" primera>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Controller
                  control={control}
                  name="proveedor_id"
                  render={({ field }) => (
                    <Autocomplete
                      options={proveedores}
                      value={proveedor}
                      onChange={(_, next) => {
                        field.onChange(next?.id ?? '')
                        // Con proveedor bloqueado solo se admite contado.
                        if (next?.bloqueado) setValue('condicion', 'contado')
                      }}
                      onBlur={field.onBlur}
                      disabled={formState.disabled}
                      getOptionLabel={(p) => (p.rif_ci ? `${p.nombre} · ${p.rif_ci}` : p.nombre)}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      noOptionsText="Sin proveedores activos"
                      renderOption={({ key, ...props }, p) => (
                        <Box component="li" key={key} {...props} sx={{ gap: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2">{p.nombre}</Typography>
                            {p.rif_ci ? (
                              <Typography variant="caption" color="text.secondary">
                                {p.rif_ci}
                              </Typography>
                            ) : null}
                          </Box>
                          {p.bloqueado ? <Chip label="Bloqueado" size="small" color="error" /> : null}
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Proveedor *"
                          size="small"
                          error={!!formState.errors.proveedor_id}
                          helperText={formState.errors.proveedor_id?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Fecha *"
                  type="date"
                  fullWidth
                  size="small"
                  disabled={formState.disabled}
                  {...register('fecha')}
                  error={!!formState.errors.fecha}
                  helperText={formState.errors.fecha?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>

            {proveedor?.bloqueado ? (
              <Alert severity="warning">
                {proveedor.nombre} está bloqueado
                {proveedor.motivo_bloqueo ? ` (${proveedor.motivo_bloqueo})` : ''}: solo se le puede
                comprar de contado.
              </Alert>
            ) : null}
          </FormSection>

          <FormSection titulo="Condiciones y pago">
            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                  Condición
                </Typography>
                <Controller
                  control={control}
                  name="condicion"
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={field.value}
                      disabled={formState.disabled}
                      onChange={(_, next) => next && field.onChange(next)}
                      aria-label="Condición de pago"
                    >
                      <ToggleButton value="contado">Contado</ToggleButton>
                      <ToggleButton value="credito" disabled={!!proveedor?.bloqueado}>
                        Crédito
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
                {formState.errors.condicion ? (
                  <Typography variant="caption" color="error" component="p">
                    {formState.errors.condicion.message}
                  </Typography>
                ) : null}
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                  Moneda pactada
                </Typography>
                <Controller
                  control={control}
                  name="moneda"
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={field.value}
                      disabled={formState.disabled}
                      onChange={(_, next) => next && field.onChange(next)}
                      aria-label="Moneda de la compra"
                    >
                      <ToggleButton value="usd">USD</ToggleButton>
                      <ToggleButton value="bs">Bs</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TasaSelector
                  fecha={fecha ?? fechaHoy()}
                  config={configTasas}
                  onReferencial={setReferencial}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Notas"
                  fullWidth
                  size="small"
                  multiline
                  maxRows={3}
                  disabled={formState.disabled}
                  {...register('notas')}
                  placeholder="Ej. N.º de guía, lote"
                />
              </Grid>
            </Grid>
          </FormSection>

          <FormSection titulo="Recepción">
            <CompraItemsFieldArray productos={productos} />

            <Box
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                pt: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, auto)' },
                justifyContent: { sm: 'end' },
                columnGap: 4,
                rowGap: 1,
              }}
            >
              <Resumen label="Peso total" value={`${totalKg.toFixed(3)} kg`} />
              <Resumen label="Total USD" value={totalUsd != null ? formatUsd(totalUsd) : '—'} destacado />
              <Resumen label="Equivalente Bs" value={totalBs != null ? formatBs(totalBs) : '—'} />
            </Box>

            {condicion === 'credito' && totalUsd ? (
              <Alert severity="info">
                Quedará una cuenta por pagar de {formatUsd(totalUsd)} a {proveedor?.nombre ?? 'este proveedor'}.
              </Alert>
            ) : null}
          </FormSection>
        </Box>
      </FormProvider>
    </AppDialog>
  )
}

function Resumen({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <Box sx={{ textAlign: { sm: 'right' } }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant={destacado ? 'h6' : 'body2'} sx={MONO}>
        {value}
      </Typography>
    </Box>
  )
}
