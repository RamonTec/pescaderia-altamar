'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import { NumberField } from '@/components/atoms/NumberField'
import {
  pedirConfirmacionTasaManual,
  TasaSelector,
  type ReferencialTasa,
  type TasaSelectorConfig,
} from '@/components/organisms/TasaSelector'
import { entregaPedidoSchema, type EntregaPedidoInput, type EntregaPedidoValues } from '@/lib/pedidoValidation'
import { fechaHoy, formatFecha, formatKg, formatUsd } from '@/lib/format'
import type { AdvertenciaLimiteCredito } from '@/lib/services/invoiceService'
import type { PedidoDetalle } from '@/lib/repositories/interfaces'
import { entregarPedidoAction } from '@/app/(protected)/pedidos/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface EntregaPedidoDialogProps {
  pedido: PedidoDetalle | null
  /** Config de tasas de `config_negocio` (08-tasas Fase D). */
  configTasas: TasaSelectorConfig
  onClose: () => void
}

function vacio(pedidoId: string): EntregaPedidoInput {
  return {
    pedido_id: pedidoId,
    fecha: fechaHoy(),
    condicion: 'credito',
    // 08-tasas Fase D: `TasaSelector` resuelve la referencial por fecha y
    // completa origen/fuente/valor (o exige la manual).
    tasa_origen: 'referencial',
    tasa_fuente: null,
    tasa: null,
    pesos_reales: [],
  }
}

/**
 * Entrega de un pedido pendiente: captura el peso real por item y genera la
 * factura con esos kg. La tasa se elige con `TasaSelector` (referencial por
 * fecha o manual). Montar con `key={pedido.id}` para reiniciar el form.
 */
export function EntregaPedidoDialog({ pedido, configTasas, onClose }: EntregaPedidoDialogProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<
    EntregaPedidoInput,
    unknown,
    EntregaPedidoValues
  >({
    resolver: zodResolver(entregaPedidoSchema),
    mode: 'onSubmit',
    defaultValues: vacio(pedido?.id ?? ''),
    values: pedido
      ? {
          pedido_id: pedido.id,
          fecha: fechaHoy(),
          condicion: 'credito',
          tasa_origen: 'referencial',
          tasa_fuente: null,
          tasa: null,
          pesos_reales: pedido.items.map((i) => ({
            pedido_item_id: i.id,
            peso_kg: null,
          })),
        }
      : undefined,
  })
  const { control, register, handleSubmit, setError, formState } = methods
  const fecha = useWatch({ control, name: 'fecha' })

  // Referencial vigente que el `TasaSelector` reporta (08-tasas).
  const [referencial, setReferencial] = React.useState<ReferencialTasa | null>(null)

  if (!pedido) return null

  const totalUsd = pedido.items.reduce((s, i) => s + Number(i.peso_estimado_kg) * Number(i.precio_usd_kg), 0)

  const enviar = (values: EntregaPedidoValues, forzarLimite: boolean) => {
    setServerError(null)
    const formData = new FormData()
    // `TasaSelector` fija `tasa_origen`/`tasa_fuente`/`tasa`; el servidor
    // recalcula la referencial y avisa si cambió (canal `info`).
    formData.set('payload', JSON.stringify(values))
    formData.set('forzar_limite', String(forzarLimite))

    startTransition(async () => {
      const result = await entregarPedidoAction({ error: null, success: null }, formData)
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
      notify.success(result.success ?? 'Pedido entregado')
      if (result.info) notify.info(result.info)
      onClose()
    })
  }

  const pedirConfirmacionLimite = async (
    values: EntregaPedidoValues,
    advertencia: AdvertenciaLimiteCredito
  ) => {
    const ok = await confirm({
      title: 'Excede el límite de crédito',
      message: `El saldo pendiente (${formatUsd(advertencia.saldo_actual_usd)}) más esta factura supera el límite de ${formatUsd(advertencia.limite_usd)}. ¿Forzar la venta a crédito?`,
      confirmLabel: 'Forzar venta',
      destructive: true,
    })
    if (ok) enviar(values, true)
  }

  const onSubmit = handleSubmit(async (values) => {
    // Confirmación del umbral de desviación de la tasa manual (08-tasas).
    const ok = await pedirConfirmacionTasaManual(
      confirm,
      values,
      referencial,
      configTasas.umbral_desviacion_tasa_pct
    )
    if (!ok) return
    enviar(values, false)
  })

  return (
    <Dialog open={!!pedido} onClose={isPending ? undefined : onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <DialogTitle>Entregar pedido</DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', gap: 1 }}>
              <Box>
                <Typography variant="body2">{pedido.cliente?.nombre}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Pedido del {formatFecha(pedido.fecha)} · total estimado {formatUsd(totalUsd)}
                </Typography>
              </Box>
            </Box>

            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, sm: 6 }}>
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
                      fullWidth
                      value={field.value}
                      onChange={(_, next) => next && field.onChange(next)}
                      aria-label="Condición de pago"
                    >
                      <ToggleButton value="contado">Contado</ToggleButton>
                      <ToggleButton value="credito">Crédito</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Typography variant="h6">Peso real entregado</Typography>
              {pedido.items.map((item, index) => (
                <Box key={item.id} sx={{ display: 'grid', gap: 0.5 }}>
                  <Controller
                    control={control}
                    name={`pesos_reales.${index}.peso_kg`}
                    render={({ field }) => (
                      <NumberField
                        label={`${item.producto.nombre} (estimado ${formatKg(Number(item.peso_estimado_kg))})`}
                        fullWidth
                        size="small"
                        decimals={3}
                        suffix="kg"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={!!formState.errors.pesos_reales?.[index]?.peso_kg}
                        helperText={formState.errors.pesos_reales?.[index]?.peso_kg?.message}
                      />
                    )}
                  />
                </Box>
              ))}
            </Box>

            <TasaSelector
              fecha={fecha || fechaHoy()}
              config={configTasas}
              onReferencial={setReferencial}
              titulo="Tasa de la factura"
            />

            {serverError ? <Alert severity="error">{serverError}</Alert> : null}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Entregar y facturar
          </Button>
        </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  )
}
