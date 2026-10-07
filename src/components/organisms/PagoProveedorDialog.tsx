'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

import { AppDialog } from '@/components/organisms/AppDialog'
import { NumberField } from '@/components/atoms/NumberField'
import {
  pedirConfirmacionTasaManual,
  TasaSelector,
  type ReferencialTasa,
  type TasaSelectorConfig,
} from '@/components/organisms/TasaSelector'
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
import { useConfirm } from '@/lib/useConfirm'

const MONO = { fontVariantNumeric: 'tabular-nums' }

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
  configTasas: TasaSelectorConfig
  onClose: () => void
}

function vacio(compraId: string): PagoProveedorFormInput {
  return {
    compra_id: compraId,
    fecha: fechaHoy(),
    moneda_pago: 'usd',
    metodo: 'transferencia',
    monto: null,
    // 08-tasas Fase D: `TasaSelector` resuelve la referencial por fecha y
    // completa origen/fuente/valor (o exige la manual).
    tasa_origen: 'referencial',
    tasa_fuente: null,
    tasa: null,
  }
}

/**
 * Montar con `key={compra.id}`: el formulario toma sus valores iniciales al montarse.
 *
 * Abono a una compra a crédito. La deuda está en USD; un pago en Bs se
 * convierte con la tasa elegida (`TasaSelector`) y muestra la ganancia
 * cambiaria frente a la tasa congelada en la compra (/SPEC.md §4.5).
 */
export function PagoProveedorDialog({ compra, configTasas, onClose }: PagoProveedorDialogProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<
    PagoProveedorFormInput,
    unknown,
    PagoProveedorFormValues
  >({
    resolver: zodResolver(pagoProveedorFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(compra?.id ?? ''),
  })
  const { control, register, handleSubmit, setError, setValue, formState } = methods

  const [moneda, monto, tasa, fecha] = useWatch({
    control,
    name: ['moneda_pago', 'monto', 'tasa', 'fecha'],
  })

  // Referencial vigente que el `TasaSelector` reporta (08-tasas).
  const [referencial, setReferencial] = React.useState<ReferencialTasa | null>(null)

  if (!compra) return null

  const saldo = saldoPendiente(Number(compra.subtotal_usd), Number(compra.pagado_usd))
  const tasaCompra = Number(compra.tasa_snapshot)
  const tasaValida = tasa != null && tasa > 0
  const montoUsd = monto != null && tasaValida ? usdEquivalentes(monto, moneda, tasa) : null
  const restante = montoUsd != null ? Math.max(saldo - montoUsd, 0) : null
  const excede = montoUsd != null && montoUsd > saldo + 0.01
  const ganancia =
    montoUsd != null && tasaValida
      ? gananciaCambiariaBs(tasaCompra, tasa, Math.min(montoUsd, saldo), moneda)
      : null

  const pagarSaldo = () => {
    if (moneda === 'usd') setValue('monto', saldo, { shouldDirty: true })
    else if (tasaValida) setValue('monto', Math.round(saldo * tasa * 100) / 100, { shouldDirty: true })
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
      if (result.info) notify.info(result.info)
      onClose()
    })
  })

  return (
    <AppDialog
      open={!!compra}
      onClose={onClose}
      size="sm"
      title="Registrar pago"
      onSubmit={(e) => {
        onSubmit(e)
      }}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      primaryAction={
        <Button
          type="submit"
          variant="contained"
          disabled={excede}
          loading={isPending}
        >
          Registrar pago
        </Button>
      }
    >
      <FormProvider {...methods}>
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
                    size="small"
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
              <TasaSelector
                fecha={fecha || fechaHoy()}
                config={configTasas}
                onReferencial={setReferencial}
                titulo="Tasa del pago"
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
                    size="small"
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
        </Box>
      </FormProvider>
    </AppDialog>
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
