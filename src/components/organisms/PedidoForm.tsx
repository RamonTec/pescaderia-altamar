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
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { PedidoItemsFieldArray, pedidoItemVacio } from '@/components/molecules/PedidoItemsFieldArray'
import {
  pedirConfirmacionTasaManual,
  TasaSelector,
  type ReferencialTasa,
  type TasaSelectorConfig,
} from '@/components/organisms/TasaSelector'
import { pedidoFormSchema, type PedidoFormInput, type PedidoFormValues } from '@/lib/pedidoValidation'
import { fechaHoy, formatBs, formatUsd } from '@/lib/format'
import type { AdvertenciaLimiteCredito } from '@/lib/services/invoiceService'
import type { Cliente, Producto } from '@/types/domain'
import { crearPedidoAction } from '@/app/(protected)/pedidos/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

const MONO = { fontFamily: 'var(--font-geist-mono)', fontVariantNumeric: 'tabular-nums' }

export interface PedidoFormProps {
  open: boolean
  onClose: () => void
  clientes: Cliente[]
  productos: Producto[]
  /** Config de tasas de `config_negocio` (08-tasas Fase D). */
  configTasas: TasaSelectorConfig
}

function vacio(): PedidoFormInput {
  return {
    cliente_id: '',
    entrega_inmediata: false,
    fecha: fechaHoy(),
    fecha_entrega: null,
    condicion: 'contado',
    notas: '',
    // 08-tasas Fase D: `TasaSelector` resuelve la referencial por fecha y
    // completa origen/fuente/valor; solo la venta directa la exige.
    tasa_origen: 'referencial',
    tasa_fuente: null,
    tasa: null,
    items: [pedidoItemVacio()],
  }
}

/**
 * Un solo formulario para pedido agendado y venta directa (POS):
 * - `entrega_inmediata = false`: pedido agendado (fecha de entrega + peso estimado).
 * - `entrega_inmediata = true`: venta directa (peso real → factura al guardar);
 *   la tasa se elige con `TasaSelector` (referencial por fecha o manual).
 *
 * Si una venta a crédito excede el límite del cliente, el servidor devuelve la
 * advertencia estructurada y aquí se pide confirmación; al confirmar se reintenta
 * con `forzar_limite = true`.
 */
export function PedidoForm({ open, onClose, clientes, productos, configTasas }: PedidoFormProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<PedidoFormInput, unknown, PedidoFormValues>({
    resolver: zodResolver(pedidoFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(),
  })
  const { control, register, handleSubmit, setError, setValue, formState } = methods

  const [clienteId, entregaInmediata, condicion, fecha, items] = useWatch({
    control,
    name: ['cliente_id', 'entrega_inmediata', 'condicion', 'fecha', 'items'],
  })
  const cliente = clientes.find((c) => c.id === clienteId) ?? null

  // Referencial vigente que el `TasaSelector` reporta (08-tasas): se usa
  // para la confirmación del umbral al enviar.
  const [referencial, setReferencial] = React.useState<ReferencialTasa | null>(null)

  const totalUsd = (items ?? []).reduce(
    (s, i) => s + (i.peso_kg != null && i.precio_usd_kg != null ? i.peso_kg * i.precio_usd_kg : 0),
    0
  )

  const pedirCierre = async () => {
    if (formState.isDirty) {
      const ok = await confirm({
        title: '¿Descartar?',
        message: 'Hay datos sin guardar. ¿Descartarlos?',
        confirmLabel: 'Descartar',
        destructive: true,
      })
      if (!ok) return
    }
    onClose()
  }

  const enviar = (values: PedidoFormValues, forzarLimite: boolean) => {
    setServerError(null)
    const formData = new FormData()
    // `TasaSelector` fija `tasa_origen`/`tasa_fuente`/`tasa`; el servidor
    // recalcula la referencial y avisa si cambió mientras el form estaba
    // abierto (canal `info`).
    formData.set('payload', JSON.stringify(values))
    formData.set('forzar_limite', String(forzarLimite))

    startTransition(async () => {
      const result = await crearPedidoAction({ error: null, success: null }, formData)
      if (result.advertenciaLimite) {
        await pedirConfirmacionLimite(values, result.advertenciaLimite)
        return
      }
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          // @ts-expect-error setError con path dinámico
          setError(campo, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Listo')
      if (result.info) notify.info(result.info)
      onClose()
    })
  }

  const pedirConfirmacionLimite = async (
    values: PedidoFormValues,
    advertencia: AdvertenciaLimiteCredito
  ) => {
    const ok = await confirm({
      title: 'Excede el límite de crédito',
      message: `El saldo pendiente (${formatUsd(advertencia.saldo_actual_usd)}) más esta venta (${formatUsd(
        advertencia.nuevo_total_usd
      )}) supera el límite de ${formatUsd(advertencia.limite_usd)} en ${formatUsd(
        advertencia.excedente_usd
      )}. ¿Forzar la venta a crédito?`,
      confirmLabel: 'Forzar venta',
      destructive: true,
    })
    if (ok) enviar(values, true)
  }

  const onSubmit = handleSubmit(async (values) => {
    // La tasa solo se exige en la venta directa: el pedido agendado la
    // congela al entregar (spec 08-tasas).
    if (entregaInmediata) {
      const ok = await pedirConfirmacionTasaManual(
        confirm,
        values,
        referencial,
        configTasas.umbral_desviacion_tasa_pct
      )
      if (!ok) return
    }
    enviar(values, false)
  })

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : pedirCierre}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
    >
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <DialogTitle>Nueva venta / pedido</DialogTitle>

          <DialogContent dividers>
            <Box sx={{ display: 'grid', gap: 3 }}>
              <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <Controller
                    control={control}
                    name="cliente_id"
                    render={({ field }) => (
                      <Autocomplete
                        options={clientes}
                        value={cliente}
                        onChange={(_, next) => {
                          field.onChange(next?.id ?? '')
                          if (next?.bloqueado) setValue('condicion', 'contado')
                        }}
                        onBlur={field.onBlur}
                        getOptionLabel={(c) => (c.rif_ci ? `${c.nombre} · ${c.rif_ci}` : c.nombre)}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        noOptionsText="Sin clientes activos"
                        renderOption={({ key, ...props }, c) => (
                          <Box component="li" key={key} {...props} sx={{ gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2">{c.nombre}</Typography>
                              {c.rif_ci ? (
                                <Typography variant="caption" color="text.secondary">
                                  {c.rif_ci}
                                </Typography>
                              ) : null}
                            </Box>
                            {c.bloqueado ? <Chip label="Bloqueado" size="small" color="error" /> : null}
                          </Box>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Cliente *"
                            error={!!formState.errors.cliente_id}
                            helperText={formState.errors.cliente_id?.message}
                          />
                        )}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                    Tipo de venta
                  </Typography>
                  <Controller
                    control={control}
                    name="entrega_inmediata"
                    render={({ field }) => (
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        fullWidth
                        value={field.value}
                        onChange={(_, next: boolean | null) => next != null && field.onChange(next)}
                        aria-label="Tipo de venta"
                      >
                        <ToggleButton value={false}>Pedido agendado</ToggleButton>
                        <ToggleButton value>Entrega inmediata</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  />
                </Grid>
              </Grid>

              {cliente?.bloqueado ? (
                <Alert severity="error">
                  {cliente.nombre} está bloqueado: no se le puede vender a crédito.
                </Alert>
              ) : null}

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Fecha *"
                    type="date"
                    fullWidth
                    size="small"
                    {...register('fecha')}
                    error={!!formState.errors.fecha}
                    helperText={formState.errors.fecha?.message}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                {!entregaInmediata ? (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Fecha de entrega"
                      type="date"
                      fullWidth
                      size="small"
                      value={methods.getValues('fecha_entrega') ?? ''}
                      onChange={(e) =>
                        setValue('fecha_entrega', e.target.value || null, { shouldDirty: true })
                      }
                      error={!!formState.errors.fecha_entrega}
                      helperText={formState.errors.fecha_entrega?.message}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Grid>
                ) : null}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                    Condición de pago
                  </Typography>
                  <Controller
                    control={control}
                    name="condicion"
                    render={({ field }) => (
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        fullWidth
                        value={field.value}
                        onChange={(_, next) => next && field.onChange(next)}
                        aria-label="Condición de pago"
                      >
                        <ToggleButton value="contado">Contado</ToggleButton>
                        <ToggleButton value="credito" disabled={!!cliente?.bloqueado}>
                          Crédito
                        </ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  />
                </Grid>
              </Grid>

              {!entregaInmediata ? (
                <TextField
                  label="Notas"
                  fullWidth
                  size="small"
                  multiline
                  maxRows={3}
                  {...register('notas')}
                  placeholder="Ej. Entregar en dos lotes"
                />
              ) : null}

              <PedidoItemsFieldArray
                productos={productos}
                etiquetaPeso={entregaInmediata ? 'Peso real' : 'Peso estimado'}
              />

              {entregaInmediata ? (
                <TasaSelector
                  fecha={fecha || fechaHoy()}
                  config={configTasas}
                  onReferencial={setReferencial}
                  renderEquivalencia={(tasaFinal) =>
                    totalUsd && tasaFinal ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Equivale a {formatBs(totalUsd * tasaFinal)} con esta tasa.
                      </Typography>
                    ) : null
                  }
                />
              ) : null}

              <Box
                sx={{
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  pt: 2,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">
                    Total USD
                  </Typography>
                  <Typography variant="h6" sx={MONO}>
                    {formatUsd(totalUsd)}
                  </Typography>
                </Box>
              </Box>

              {condicion === 'credito' && totalUsd ? (
                <Alert severity="info">
                  Quedará una cuenta por cobrar de {formatUsd(totalUsd)} a{' '}
                  {cliente?.nombre ?? 'este cliente'}.
                </Alert>
              ) : null}

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
              disabled={isPending || productos.length === 0}
              startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {entregaInmediata ? 'Registrar venta' : 'Crear pedido'}
            </Button>
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  )
}
