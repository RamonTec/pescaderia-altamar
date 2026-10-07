'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { NumberField } from '@/components/atoms/NumberField'
import type { CompraFila } from '@/components/organisms/ComprasTable'
import {
  METODOS_POR_MONEDA,
  pagoProveedorFormSchema,
  type PagoProveedorFormInput,
  type PagoProveedorFormValues,
} from '@/lib/compraValidation'
import { gananciaCambiariaBs, saldoPendiente, usdEquivalentes } from '@/lib/services/creditService'
import { fechaHoy, formatBs, formatFecha, formatTasa, formatUsd } from '@/lib/format'
import type { MetodoPago } from '@/types/domain'
import { registrarPagoProveedorAction } from '@/app/(protected)/compras/actions'
import { useNotify } from '@/lib/useNotify'

const MONO = { fontFamily: 'var(--font-geist-mono)', fontVariantNumeric: 'tabular-nums' }

const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo_usd: 'Efectivo USD',
  efectivo_bs: 'Efectivo Bs',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  punto: 'Punto de venta',
}

export interface PagoProveedorDialogProps {
  compra: CompraFila | null
  tasaDelDia: number | null
  onClose: () => void
}

function vacio(compraId: string, tasa: number | null): PagoProveedorFormInput {
  return {
    compra_id: compraId,
    fecha: fechaHoy(),
    moneda_pago: 'usd',
    metodo: 'transferencia',
    monto: null,
    tasa_pago: tasa,
  }
}

/**
 * Montar con `key={compra.id}`: el formulario toma sus valores iniciales al montarse.
 *
 * Abono a una compra a crédito. La deuda está en USD; un pago en Bs se
 * convierte con la tasa del día y muestra la ganancia cambiaria frente a la
 * tasa congelada en la compra (/SPEC.md §4.5).
 */
export function PagoProveedorDialog({ compra, tasaDelDia, onClose }: PagoProveedorDialogProps) {
  const notify = useNotify()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    PagoProveedorFormInput,
    unknown,
    PagoProveedorFormValues
  >({
    resolver: zodResolver(pagoProveedorFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(compra?.id ?? '', tasaDelDia),
  })

  const [moneda, monto, tasaPago] = useWatch({
    control,
    name: ['moneda_pago', 'monto', 'tasa_pago'],
  })

  if (!compra) return null

  const saldo = saldoPendiente(Number(compra.subtotal_usd), Number(compra.pagado_usd))
  const tasaCompra = Number(compra.tasa_snapshot)
  const tasaValida = tasaPago != null && tasaPago > 0
  const montoUsd = monto != null && tasaValida ? usdEquivalentes(monto, moneda, tasaPago) : null
  const restante = montoUsd != null ? Math.max(saldo - montoUsd, 0) : null
  const excede = montoUsd != null && montoUsd > saldo + 0.01
  const ganancia =
    montoUsd != null && tasaValida
      ? gananciaCambiariaBs(tasaCompra, tasaPago, Math.min(montoUsd, saldo), moneda)
      : null

  const pagarSaldo = () => {
    if (moneda === 'usd') setValue('monto', saldo, { shouldDirty: true })
    else if (tasaValida) setValue('monto', Math.round(saldo * tasaPago * 100) / 100, { shouldDirty: true })
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    const formData = new FormData()
    formData.set('payload', JSON.stringify(values))

    startTransition(async () => {
      const result = await registrarPagoProveedorAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          // @ts-expect-error setError con path dinámico
          setError(campo, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Pago registrado')
      onClose()
    })
  })

  return (
    <Dialog
      open={!!compra}
      onClose={isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <Box component="form" onSubmit={onSubmit} noValidate>
        <DialogTitle>Registrar pago</DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
                p: 2,
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="body2">{compra.proveedor?.nombre}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Compra del {formatFecha(compra.fecha)} · tasa {formatTasa(tasaCompra)}
                </Typography>
              </Box>
              <Dato label="Total" value={formatUsd(Number(compra.subtotal_usd))} />
              <Dato label="Pagado" value={formatUsd(Number(compra.pagado_usd))} />
              <Dato label="Saldo" value={formatUsd(saldo)} />
            </Box>

            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="moneda_pago"
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={field.value}
                      onChange={(_, next: 'usd' | 'bs' | null) => {
                        if (!next) return
                        field.onChange(next)
                        setValue('monto', null)
                        setValue('metodo', next === 'usd' ? 'transferencia' : 'pago_movil')
                      }}
                      aria-label="Moneda del pago"
                    >
                      <ToggleButton value="usd">Pago en USD</ToggleButton>
                      <ToggleButton value="bs">Pago en Bs</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
              </Grid>
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
                <Controller
                  control={control}
                  name="metodo"
                  render={({ field }) => (
                    <TextField
                      select
                      label="Método *"
                      fullWidth
                      value={field.value}
                      onChange={field.onChange}
                      error={!!formState.errors.metodo}
                      helperText={formState.errors.metodo?.message}
                    >
                      {METODOS_POR_MONEDA[moneda].map((m) => (
                        <MenuItem key={m} value={m}>
                          {METODO_LABEL[m]}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="tasa_pago"
                  render={({ field }) => (
                    <NumberField
                      label="Tasa del pago (Bs/USD) *"
                      fullWidth
                      decimals={4}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={!!formState.errors.tasa_pago}
                      helperText={formState.errors.tasa_pago?.message}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <Controller
                  control={control}
                  name="monto"
                  render={({ field }) => (
                    <NumberField
                      label={`Monto (${moneda === 'usd' ? 'USD' : 'Bs'}) *`}
                      fullWidth
                      decimals={2}
                      prefix={moneda === 'usd' ? '$' : 'Bs'}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={!!formState.errors.monto || excede}
                      helperText={
                        formState.errors.monto?.message ??
                        (excede ? 'El monto supera el saldo pendiente' : undefined)
                      }
                    />
                  )}
                />
                <Link component="button" type="button" variant="caption" onClick={pagarSaldo}>
                  Pagar el saldo completo
                </Link>
              </Grid>
            </Grid>

            {montoUsd != null ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                <Dato label="Abona (USD)" value={formatUsd(Math.min(montoUsd, saldo))} />
                <Dato label="Saldo restante" value={restante != null ? formatUsd(restante) : '—'} />
                {moneda === 'bs' && ganancia != null ? (
                  <Dato
                    label={ganancia >= 0 ? 'Ganancia cambiaria' : 'Pérdida cambiaria'}
                    value={formatBs(Math.abs(ganancia))}
                  />
                ) : null}
              </Box>
            ) : null}

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
            disabled={isPending || excede}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Registrar pago
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={MONO}>
        {value}
      </Typography>
    </Box>
  )
}
