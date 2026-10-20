'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { AppDialog } from '@/components/organisms/AppDialog'
import { FilaPrevia, type CorreccionActionState } from '@/components/organisms/CorregirLineaFacturaDialog'
import { cambiarIvaSchema, type CambiarIvaInput, type CambiarIvaValues } from '@/lib/correccionFacturaValidation'
import { previsualizarCambioIva } from '@/lib/facturas/correccion'
import { etiquetaIva, facturaConIva, formatIvaPct } from '@/lib/facturas/iva'
import { numeroFactura } from '@/lib/repositories/carteraRepository'
import { numeroContrato } from '@/lib/contratos/textos'
import { formatUsd } from '@/lib/format'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import type { DetalleFactura } from '@/types/domain'

const ESTADO_CONTRATO: Record<string, string> = {
  generado: 'generado',
  enviado: 'enviado',
  firmado: 'firmado',
}

const MSG_BLOQUEO = {
  sin_cambios: 'La factura ya está así: no hay nada que cambiar.',
  iva_config_cero: 'El IVA configurado es 0 %: no hay IVA que aplicar. Cámbialo en Catálogos › Configuración.',
} as const

export interface CambiarIvaFacturaDialogProps {
  detalle: DetalleFactura
  open: boolean
  /** `config_negocio.iva_pct` vigente: el que se aplica al activar. */
  ivaPctConfig: number
  onClose: () => void
  /** Server Action (`cambiarIvaFacturaAction`). */
  onCambiar: (values: CambiarIvaValues) => Promise<CorreccionActionState>
  /** Tras guardar (la ficha refresca). */
  onCambiado?: () => void
}

/**
 * Activa o quita el IVA de una factura emitida (18-iva-opcional, solo
 * admin), con motivo obligatorio. Vista previa con la misma cuenta que la RPC
 * `cambiar_iva_factura` (IVA, total, créditos de notas y saldo antes →
 * después) y avisos de abonos, saldo a favor, contrato, notas de crédito,
 * contado y % vigente. `AppDialog sm`, pantalla completa en `xs`.
 */
export function CambiarIvaFacturaDialog({
  detalle,
  open,
  ivaPctConfig,
  onClose,
  onCambiar,
  onCambiado,
}: CambiarIvaFacturaDialogProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const enviandoRef = React.useRef(false)
  const { factura, contrato } = detalle
  const numero = numeroFactura(factura.numero)
  // Fijo al abrir: tras guardar, la ficha refresca y no debe cambiar el título mientras cierra.
  const [aplicar] = React.useState(() => !facturaConIva(factura))

  const { register, handleSubmit, setError, formState } = useForm<CambiarIvaInput, unknown, CambiarIvaValues>({
    resolver: zodResolver(cambiarIvaSchema),
    mode: 'onSubmit',
    disabled: isPending,
    values: { factura_id: factura.id, aplica_iva: aplicar, motivo: '' },
  })
  const { errors } = formState

  const notasEmitidas = React.useMemo(
    () => detalle.notas_credito.filter((n) => n.estado === 'emitida'),
    [detalle.notas_credito]
  )
  const vista = React.useMemo(
    () => previsualizarCambioIva(factura, notasEmitidas, aplicar, ivaPctConfig),
    [factura, notasEmitidas, aplicar, ivaPctConfig]
  )

  // % que tenía la factura antes de quitarle el IVA (última corrección de IVA).
  const pctPrevio = React.useMemo(() => {
    const ultima = detalle.correcciones.find((c) => c.tipo === 'iva')
    return ultima?.tipo === 'iva' && ultima.iva_pct_anterior > 0 ? ultima.iva_pct_anterior : null
  }, [detalle.correcciones])

  const enviar = (values: CambiarIvaValues, forzar: boolean) => {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setServerError(null)
    startTransition(async () => {
      try {
        const r = await onCambiar({ ...values, forzar_limite: forzar })
        if (r.advertenciaLimite) {
          const a = r.advertenciaLimite
          const ok = await confirm({
            title: 'Excede el límite de crédito',
            message: `El saldo pendiente del cliente (${formatUsd(a.saldo_actual_usd)}) más el IVA que se aplica (${formatUsd(a.nuevo_total_usd)}) supera su límite de ${formatUsd(a.limite_usd)}. ¿Aplicar el IVA igual?`,
            confirmLabel: 'Aplicar igual',
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
            setError(campo as keyof CambiarIvaInput, { type: 'server', message: mensaje })
          }
          return
        }
        notify.success(r.success ?? `IVA de la factura ${numero} actualizado`)
        onCambiado?.()
        onClose()
      } finally {
        enviandoRef.current = false
      }
    })
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit((v) => enviar(v, false))(e)

  const accion = aplicar ? 'Aplicar IVA' : 'Quitar IVA'
  const hayCreditos = notasEmitidas.length > 0
  const contadoConSaldo = aplicar && factura.condicion === 'contado' && vista.saldo_despues_usd > 0.005
  const otroPct = aplicar && pctPrevio !== null && pctPrevio !== ivaPctConfig

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="sm"
      title={aplicar ? `Aplicar IVA (${formatIvaPct(ivaPctConfig)})` : 'Quitar IVA'}
      subtitle={`Factura ${numero} · ${factura.cliente.nombre}`}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      onSubmit={onSubmit}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending} disabled={vista.bloqueo !== null}>
          {accion}
        </Button>
      }
    >
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        {vista.bloqueo ? <Alert severity="error">{MSG_BLOQUEO[vista.bloqueo]}</Alert> : null}

        {/* Vista previa (misma cuenta que la RPC) */}
        <Box aria-live="polite" sx={{ p: 2, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', gap: 1 }}>
          <Typography variant="subtitle2" component="p">
            Vista previa
          </Typography>
          <Box
            component="dl"
            sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5 }}
          >
            <FilaPrevia label="Subtotal" valor={formatUsd(vista.antes.subtotal_usd)} />
            <FilaPrevia
              label="IVA"
              valor={`${etiquetaIva(vista.iva_pct_antes)} ${formatUsd(vista.antes.iva_usd)} → ${etiquetaIva(vista.iva_pct_despues)} ${formatUsd(vista.despues.iva_usd)}`}
            />
            <FilaPrevia
              label="Total"
              valor={`${formatUsd(vista.antes.total_usd)} → ${formatUsd(vista.despues.total_usd)}`}
              fuerte
            />
            {hayCreditos ? (
              <FilaPrevia
                label="Notas de crédito"
                valor={`${formatUsd(vista.creditos_antes_usd)} → ${formatUsd(vista.creditos_despues_usd)}`}
              />
            ) : null}
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
        </Box>

        <TextField
          label="Motivo *"
          fullWidth
          size="small"
          multiline
          minRows={2}
          maxRows={5}
          placeholder={aplicar ? 'Ej. el cliente sí declara IVA' : 'Ej. cliente exento, se facturó con IVA por error'}
          {...register('motivo')}
          error={!!errors.motivo}
          helperText={errors.motivo?.message ?? 'Entre 5 y 500 caracteres. Solo lo ve el administrador.'}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />

        {otroPct ? (
          <Alert severity="info">
            Se aplicará el {formatIvaPct(ivaPctConfig)} vigente (la factura tenía {formatIvaPct(pctPrevio ?? 0)}).
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
        {hayCreditos ? (
          <Alert severity="info">
            {notasEmitidas.length === 1 ? 'La nota de crédito emitida' : `Las ${notasEmitidas.length} notas de crédito emitidas`}{' '}
            {notasEmitidas.length === 1 ? 'recalcula' : 'recalculan'} su IVA al nuevo %: el subtotal y los kg no cambian.
          </Alert>
        ) : null}
        {contrato ? (
          <Alert severity="warning">
            El contrato {numeroContrato(contrato.numero)} ({ESTADO_CONTRATO[contrato.estado] ?? contrato.estado}) quedará
            desactualizado: anúlalo y genera otro desde el menú ⋮.
          </Alert>
        ) : null}
      </Box>
    </AppDialog>
  )
}
