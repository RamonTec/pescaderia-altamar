'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import { AppDialog } from '@/components/organisms/AppDialog'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { DiasCreditoField } from '@/components/molecules/DiasCreditoField'
import { IvaVentaSwitch } from '@/components/molecules/IvaVentaSwitch'
import { TotalesVenta, totalesVenta } from '@/components/molecules/TotalesVenta'
import { LotesLineaVenta } from '@/components/organisms/LotesLineaVenta'
import {
  pedirConfirmacionTasaManual,
  TasaSelector,
  type ReferencialTasa,
  type TasaSelectorConfig,
} from '@/components/organisms/TasaSelector'
import { entregaPedidoSchema, type EntregaPedidoInput, type EntregaPedidoValues } from '@/lib/pedidoValidation'
import { fechaHoy, formatBs, formatFecha, formatKg, formatUsd } from '@/lib/format'
import { ivaPctVenta } from '@/lib/facturas/iva'
import type { AdvertenciaLimiteCredito } from '@/lib/services/invoiceService'
import type { PedidoDetalle } from '@/lib/repositories/interfaces'
import type { Producto } from '@/types/domain'
import { entregarPedidoAction } from '@/app/(protected)/pedidos/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface EntregaPedidoDialogProps {
  pedido: PedidoDetalle | null
  /** Config de tasas de `config_negocio` (08-tasas Fase D). */
  configTasas: TasaSelectorConfig
  /** Días de crédito del negocio para clientes sin días propios (09). */
  diasCreditoDefault: number
  /** `config_negocio.iva_pct` vigente: el % de las ventas con IVA (18). */
  ivaPct: number
  /** Productos (para saber cuáles controlan stock y usan lotes, 07-lotes). */
  productos: Producto[]
  onClose: () => void
}

function vacio(pedidoId: string): EntregaPedidoInput {
  return {
    pedido_id: pedidoId,
    fecha: fechaHoy(),
    condicion: 'credito',
    dias_credito: null,
    aplica_iva: true,
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
 *
 * 18-iva-opcional: el pedido no guarda IVA; `IvaVentaSwitch` viene
 * precargado con el "Aplica IVA" actual del cliente y decide el IVA de esta
 * factura. `TotalesVenta` usa los pesos reales capturados.
 */
export function EntregaPedidoDialog({
  pedido,
  configTasas,
  diasCreditoDefault,
  ivaPct,
  productos,
  onClose,
}: EntregaPedidoDialogProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<
    EntregaPedidoInput,
    unknown,
    EntregaPedidoValues
  >({
    resolver: zodResolver(entregaPedidoSchema),
    mode: 'onSubmit',
    disabled: isPending,
    defaultValues: vacio(pedido?.id ?? ''),
    values: pedido
      ? {
          pedido_id: pedido.id,
          fecha: fechaHoy(),
          condicion: 'credito',
          dias_credito: pedido.cliente?.dias_credito ?? diasCreditoDefault,
          aplica_iva: pedido.cliente?.aplica_iva ?? true,
          tasa_origen: 'referencial',
          tasa_fuente: null,
          tasa: null,
          pesos_reales: pedido.items.map((i) => ({
            pedido_item_id: i.id,
            peso_kg: null,
            asignaciones: undefined,
          })),
        }
      : undefined,
  })
  const { control, register, handleSubmit, setError, setValue, formState } = methods
  const [fecha, condicion, diasCredito, pesosReales, aplicaIva] = useWatch({
    control,
    name: ['fecha', 'condicion', 'dias_credito', 'pesos_reales', 'aplica_iva'],
  })

  // 07-lotes: líneas sin stock suficiente en lotes (no se puede facturar).
  const [sinStock, setSinStock] = React.useState<Record<string, boolean>>({})
  const marcarSuficiencia = React.useCallback((itemId: string, suficiente: boolean) => {
    setSinStock((prev) =>
      !!prev[itemId] === !suficiente ? prev : { ...prev, [itemId]: !suficiente }
    )
  }, [])
  const hayFaltante = Object.values(sinStock).some(Boolean)

  // Referencial vigente que el `TasaSelector` reporta (08-tasas).
  const [referencial, setReferencial] = React.useState<ReferencialTasa | null>(null)

  if (!pedido) return null

  // 18: IVA de esta factura; estimado con los pesos del pedido y real con los capturados.
  const ivaPctEfectivo = ivaPctVenta(aplicaIva !== false, ivaPct)
  const totalEstimadoUsd = totalesVenta(
    pedido.items.map((i) => ({ peso_kg: Number(i.peso_estimado_kg), precio_usd_kg: Number(i.precio_usd_kg) })),
    ivaPctEfectivo
  ).total_usd
  const totales = totalesVenta(
    pedido.items.map((i, index) => ({
      peso_kg: pesosReales?.[index]?.peso_kg ?? null,
      precio_usd_kg: Number(i.precio_usd_kg),
    })),
    ivaPctEfectivo
  )
  const totalUsd = totales.total_usd

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
    <AppDialog
      open={!!pedido}
      onClose={onClose}
      size="sm"
      title="Entregar pedido"
      onSubmit={(e) => {
        onSubmit(e)
      }}
      pending={isPending}
      dirty={formState.isDirty}
      primaryAction={<Button type="submit" variant="contained" disabled={hayFaltante || isPending}>Entregar y facturar</Button>}
    >
      <FormProvider {...methods}>
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', gap: 1 }}>
            <Box>
              <Typography variant="body2">{pedido.cliente?.nombre}</Typography>
              <Typography variant="caption" color="text.secondary">
                Pedido del {formatFecha(pedido.fecha)} · total estimado {formatUsd(totalEstimadoUsd)}
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

          <IvaVentaSwitch
            value={aplicaIva !== false}
            onChange={(v) => setValue('aplica_iva', v, { shouldDirty: true })}
            ivaPct={ivaPct}
            habitualCliente={pedido.cliente ? pedido.cliente.aplica_iva : null}
            disabled={isPending}
            error={!!formState.errors.aplica_iva}
            helperText={formState.errors.aplica_iva?.message}
          />

          {condicion === 'credito' ? (
            <DiasCreditoField
              value={diasCredito}
              onChange={(v) => setValue('dias_credito', v, { shouldDirty: true })}
              fecha={fecha || fechaHoy()}
              diasHabituales={pedido.cliente?.dias_credito ?? diasCreditoDefault}
              error={!!formState.errors.dias_credito}
              helperText={formState.errors.dias_credito?.message}
              disabled={isPending}
            />
          ) : null}

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
                      onChange={(v) => {
                        field.onChange(v)
                        // Otro peso: la línea vuelve a PEPS (07-lotes).
                        setValue(`pesos_reales.${index}.asignaciones`, undefined)
                      }}
                      onBlur={field.onBlur}
                      error={!!formState.errors.pesos_reales?.[index]?.peso_kg}
                      helperText={formState.errors.pesos_reales?.[index]?.peso_kg?.message}
                    />
                  )}
                />
                <LotesLineaVenta
                  productoId={item.producto_id}
                  pesoKg={pesosReales?.[index]?.peso_kg}
                  controlaStock={
                    productos.find((p) => p.id === item.producto_id)?.controla_stock ?? true
                  }
                  asignaciones={pesosReales?.[index]?.asignaciones}
                  onAsignacionesChange={(a) =>
                    setValue(`pesos_reales.${index}.asignaciones`, a, { shouldDirty: true })
                  }
                  error={formState.errors.pesos_reales?.[index]?.asignaciones?.message}
                  disabled={isPending}
                  onSuficiencia={(ok) => marcarSuficiencia(item.id, ok)}
                />
              </Box>
            ))}
          </Box>

          <TasaSelector
            fecha={fecha || fechaHoy()}
            config={configTasas}
            onReferencial={setReferencial}
            titulo="Tasa de la factura"
            renderEquivalencia={(tasaFinal) =>
              totalUsd && tasaFinal ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Equivale a {formatBs(totalUsd * tasaFinal)} con esta tasa.
                </Typography>
              ) : null
            }
          />

          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, display: 'flex' }}>
            <TotalesVenta totales={totales} ivaPct={ivaPctEfectivo} />
          </Box>

          {condicion === 'credito' && totalUsd ? (
            <Alert severity="info">
              Quedará una cuenta por cobrar de {formatUsd(totalUsd)} a {pedido.cliente?.nombre ?? 'este cliente'}.
            </Alert>
          ) : null}

          {hayFaltante ? (
            <Alert severity="warning">
              Hay productos sin stock suficiente en lotes: no se puede facturar la entrega.
            </Alert>
          ) : null}

          {serverError ? <Alert severity="error">{serverError}</Alert> : null}
        </Box>
      </FormProvider>
    </AppDialog>
  )
}
