'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { AppDialog } from '@/components/organisms/AppDialog'
import {
  corregirLineaSchema,
  type CorregirLineaInput,
  type CorregirLineaValues,
} from '@/lib/correccionFacturaValidation'
import { previsualizarCorreccion, repartoBajaPeso } from '@/lib/facturas/correccion'
import { numeroFactura } from '@/lib/repositories/carteraRepository'
import { numeroContrato } from '@/lib/contratos/textos'
import { formatKg, formatUsd } from '@/lib/format'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import type { AdvertenciaLimiteCredito } from '@/lib/services/invoiceService'
import type { DetalleFactura, LineaDetalle } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

const ESTADO_CONTRATO: Record<string, string> = {
  generado: 'generado',
  enviado: 'enviado',
  firmado: 'firmado',
}

/** Resultado de la Server Action de corrección. */
export interface CorreccionActionState {
  error: string | null
  success: string | null
  fieldErrors?: Record<string, string>
  /** La factura a crédito sube por encima del límite del cliente: pedir confirmación. */
  advertenciaLimite?: AdvertenciaLimiteCredito
}

export interface CorregirLineaFacturaDialogProps {
  detalle: DetalleFactura
  /** Línea a corregir; `null` cierra el diálogo. */
  linea: LineaDetalle | null
  onClose: () => void
  /** Server Action (`corregirLineaFacturaAction`). */
  onCorregir: (values: CorregirLineaValues) => Promise<CorreccionActionState>
  /** Tras guardar (la ficha refresca). */
  onCorregida?: () => void
  /** Kg disponibles en lotes abiertos del producto (aviso previo de stock); `null` si no se sabe. */
  cargarDisponible?: (productoId: string) => Promise<number | null>
}

function vacio(detalle: DetalleFactura, linea: LineaDetalle | null): CorregirLineaInput {
  return {
    factura_id: detalle.factura.id,
    factura_item_id: linea?.id ?? '',
    peso_kg: linea?.peso_kg ?? null,
    precio_usd_kg: linea?.precio_usd_kg ?? null,
    motivo: '',
  }
}

/**
 * Corrección de una línea de factura (17, solo admin): peso y precio/kg con
 * motivo obligatorio. Vista previa en vivo de totales y saldo (misma cuenta
 * que la RPC), efecto en los lotes y avisos (abonos, saldo a favor, contrato,
 * notas de crédito, contado, stock). `AppDialog sm`, pantalla completa en `xs`.
 */
export function CorregirLineaFacturaDialog({
  detalle,
  linea,
  onClose,
  onCorregir,
  onCorregida,
  cargarDisponible,
}: CorregirLineaFacturaDialogProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [disponible, setDisponible] = React.useState<number | null>(null)
  const enviandoRef = React.useRef(false)
  const { factura } = detalle
  const numero = numeroFactura(factura.numero)

  const { control, register, handleSubmit, setError, formState } = useForm<
    CorregirLineaInput,
    unknown,
    CorregirLineaValues
  >({
    resolver: zodResolver(corregirLineaSchema),
    mode: 'onSubmit',
    disabled: isPending,
    values: vacio(detalle, linea),
  })
  const { errors } = formState
  const [peso, precio] = useWatch({ control, name: ['peso_kg', 'precio_usd_kg'] })

  // Stock disponible del producto (solo para el aviso previo; valida la RPC).
  const productoId = linea?.producto.controla_stock ? linea.producto.id : null
  React.useEffect(() => {
    let vigente = true
    if (!productoId || !cargarDisponible) return
    cargarDisponible(productoId)
      .then((kg) => {
        if (vigente) setDisponible(kg)
      })
      .catch(() => {
        if (vigente) setDisponible(null)
      })
    return () => {
      vigente = false
    }
  }, [productoId, cargarDisponible])

  const vista = React.useMemo(() => {
    if (!linea) return null
    const creditos = detalle.saldo.creditos_usd
    return previsualizarCorreccion(
      { ...factura, creditos_usd: creditos, lineas: detalle.lineas },
      linea.id,
      peso != null && peso > 0 ? peso : linea.peso_kg,
      precio != null && precio >= 0 ? precio : linea.precio_usd_kg
    )
  }, [detalle, factura, linea, peso, precio])

  const enviar = (values: CorregirLineaValues, forzar: boolean) => {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setServerError(null)
    startTransition(async () => {
      try {
        const r = await onCorregir({ ...values, forzar_limite: forzar })
        if (r.advertenciaLimite) {
          const a = r.advertenciaLimite
          const ok = await confirm({
            title: 'Excede el límite de crédito',
            message: `El saldo pendiente del cliente (${formatUsd(a.saldo_actual_usd)}) más el aumento de esta corrección (${formatUsd(a.nuevo_total_usd)}) supera su límite de ${formatUsd(a.limite_usd)}. ¿Guardar la corrección igual?`,
            confirmLabel: 'Guardar igual',
            destructive: true,
          })
          enviandoRef.current = false
          if (ok) enviar(values, true)
          return
        }
        if (r.error) {
          const campos = Object.entries(r.fieldErrors ?? {})
          setServerError(campos.length > 0 ? null : r.error)
          for (const [campo, mensaje] of campos) {
            setError(campo as keyof CorregirLineaInput, { type: 'server', message: mensaje })
          }
          return
        }
        notify.success(r.success ?? `Factura ${numero} corregida`)
        onCorregida?.()
        onClose()
      } finally {
        enviandoRef.current = false
      }
    })
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit((v) => enviar(v, false))(e)

  if (!linea || !vista) {
    return (
      <AppDialog open={false} onClose={onClose} title="Corregir línea">
        {null}
      </AppDialog>
    )
  }

  const delta = vista.delta_kg
  const cambiaPrecio = precio != null && Math.round(precio * 1e6) !== Math.round(linea.precio_usd_kg * 1e6)
  const sinLotes = linea.producto.controla_stock && linea.lotes.length === 0
  const vuelven = delta < 0 && linea.lotes.length > 0 ? repartoBajaPeso(linea.lotes, -delta) : []
  const contrato = detalle.contrato
  const contadoConSaldo =
    factura.condicion === 'contado' && vista.delta_total_usd > 0 && vista.saldo_despues_usd > 0.005
  const stockCorto =
    linea.producto.controla_stock && delta > 0 && disponible != null && disponible + 0.0005 < delta

  return (
    <AppDialog
      open={linea != null}
      onClose={onClose}
      size="sm"
      title="Corregir línea"
      subtitle={`${linea.producto.nombre} · Factura ${numero}`}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      onSubmit={onSubmit}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending} disabled={vista.sin_cambios || vista.bajo_minimo}>
          Guardar corrección
        </Button>
      }
    >
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Controller
            control={control}
            name="peso_kg"
            render={({ field }) => (
              <NumberField
                label="Peso (kg) *"
                fullWidth
                size="small"
                decimals={3}
                suffix="kg"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={field.disabled}
                error={!!errors.peso_kg || vista.bajo_minimo}
                helperText={
                  errors.peso_kg?.message ??
                  (linea.kg_devueltos > 0
                    ? `Mínimo ${formatKg(linea.kg_devueltos)}: ya devueltos por notas de crédito`
                    : `Actual: ${formatKg(linea.peso_kg)}`)
                }
              />
            )}
          />
          <Controller
            control={control}
            name="precio_usd_kg"
            render={({ field }) => (
              <NumberField
                label="Precio (USD/kg) *"
                fullWidth
                size="small"
                decimals={6}
                prefix="$"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={field.disabled}
                error={!!errors.precio_usd_kg}
                helperText={errors.precio_usd_kg?.message ?? `Actual: ${formatUsd(linea.precio_usd_kg)}`}
              />
            )}
          />
        </Box>

        <TextField
          label="Motivo *"
          fullWidth
          size="small"
          multiline
          minRows={2}
          maxRows={5}
          placeholder="Ej. error de pesaje en la báscula"
          {...register('motivo')}
          error={!!errors.motivo}
          helperText={errors.motivo?.message ?? 'Entre 5 y 500 caracteres. Solo lo ve el administrador.'}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />

        {/* Vista previa en vivo */}
        <Box
          aria-live="polite"
          sx={{ p: 2, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', gap: 1 }}
        >
          <Typography variant="subtitle2" component="p">
            Vista previa
          </Typography>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 2,
              rowGap: 0.5,
            }}
          >
            <FilaPrevia
              label="Subtotal"
              valor={`${formatUsd(vista.antes.subtotal_usd)} → ${formatUsd(vista.despues.subtotal_usd)}`}
            />
            <FilaPrevia
              label={`IVA (${factura.iva_pct.toLocaleString('es-VE')} %)`}
              valor={`${formatUsd(vista.antes.iva_usd)} → ${formatUsd(vista.despues.iva_usd)}`}
            />
            <FilaPrevia
              label="Total"
              valor={`${formatUsd(vista.antes.total_usd)} → ${formatUsd(vista.despues.total_usd)}`}
              fuerte
            />
            {vista.saldo_a_favor_despues_usd > 0 ? (
              <FilaPrevia
                label="Saldo a favor del cliente"
                valor={formatUsd(vista.saldo_a_favor_despues_usd)}
                color="success.main"
                fuerte
              />
            ) : (
              <FilaPrevia
                label="Saldo"
                valor={`${formatUsd(vista.saldo_antes_usd)} → ${formatUsd(vista.saldo_despues_usd)}`}
              />
            )}
          </Box>
          {delta !== 0 ? (
            <Typography variant="body2" sx={NUM}>
              {delta < 0
                ? vuelven.length > 0
                  ? vuelven.map((v) => `Vuelven ${formatKg(v.peso_kg)} al lote ${v.codigo}`).join(' · ')
                  : `Se devuelven ${formatKg(-delta)} (sin control de stock)`
                : linea.lotes.length > 0
                  ? `Se descuentan ${formatKg(delta)}: primero de los lotes de la línea y, si no alcanza, del más antiguo`
                  : `Salen ${formatKg(delta)} (sin control de stock)`}
            </Typography>
          ) : null}
        </Box>

        {sinLotes && delta !== 0 ? (
          <Alert severity="warning">
            Esta línea no tiene lotes asignados (venta anterior a los lotes): solo se puede corregir el precio.
          </Alert>
        ) : null}
        {stockCorto ? (
          <Alert severity="warning">
            Hay {formatKg(disponible ?? 0)} disponibles de {linea.producto.nombre} en lotes abiertos y la corrección pide{' '}
            {formatKg(delta)} más: no se podrá guardar.
          </Alert>
        ) : null}
        {factura.pagado_usd > 0 ? (
          <Alert severity="info">
            La factura tiene abonos por {formatUsd(factura.pagado_usd)}: no cambian.
            {vista.saldo_a_favor_despues_usd > 0
              ? ` Quedará un saldo a favor del cliente de ${formatUsd(vista.saldo_a_favor_despues_usd)}: se muestra, no se aplica solo a otra venta.`
              : ''}
          </Alert>
        ) : null}
        {contadoConSaldo ? (
          <Alert severity="warning">
            Factura de contado: quedará abierta con un saldo de {formatUsd(vista.saldo_despues_usd)}, vencida desde hoy.
          </Alert>
        ) : null}
        {contrato ? (
          <Alert severity="warning">
            El contrato {numeroContrato(contrato.numero)} ({ESTADO_CONTRATO[contrato.estado] ?? contrato.estado}) quedará
            desactualizado: anúlalo y genera otro desde el menú ⋮.
          </Alert>
        ) : null}
        {linea.kg_devueltos > 0 && cambiaPrecio ? (
          <Alert severity="info">
            Las notas de crédito ya emitidas no cambian: conservan el precio con que se emitieron.
          </Alert>
        ) : null}
      </Box>
    </AppDialog>
  )
}

function FilaPrevia({
  label,
  valor,
  color,
  fuerte = false,
}: {
  label: string
  valor: string
  color?: string
  fuerte?: boolean
}) {
  return (
    <>
      <Box component="dt" sx={{ typography: 'body2', color: color ?? 'text.secondary' }}>
        {label}
      </Box>
      <Box
        component="dd"
        sx={{ m: 0, typography: 'body2', textAlign: 'right', ...NUM, color, fontWeight: fuerte ? 600 : undefined }}
      >
        {valor}
      </Box>
    </>
  )
}
