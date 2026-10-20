'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { FormSection } from '@/components/molecules/FormSection'
import { LoteChip } from '@/components/molecules/LoteChip'
import { StatusChips } from '@/components/molecules/StatusChips'
import { AppDialog } from '@/components/organisms/AppDialog'
import { FilaPrevia } from '@/components/organisms/CorregirLineaFacturaDialog'
import {
  pedirConfirmacionTasaManual,
  TasaSelector,
  type ReferencialTasa,
  type TasaSelectorConfig,
} from '@/components/organisms/TasaSelector'
import { editarCompraSchema, type EditarCompraInput, type EditarCompraValues } from '@/lib/compraEdicionValidation'
import { previsualizarEdicionCompra } from '@/lib/compras/edicion'
import { formatMoneda, textoProcedenciaTasa, tituloCompra } from '@/lib/compras/textos'
import { fechaCorta } from '@/lib/contratos/textos'
import { fechaHoy, formatKg, formatTasa, formatUsd } from '@/lib/format'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import { getTasaVigenteAction } from '@/app/(protected)/tasas/actions'
import type { DetalleCompra, Proveedor } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

/** Resultado de la Server Action de edición. */
export interface EdicionCompraActionState {
  error: string | null
  success: string | null
  fieldErrors?: Record<string, string>
  info?: string | null
}

export interface EditarCompraDialogProps {
  detalle: DetalleCompra
  open: boolean
  /** Proveedores activos más el actual de la compra (aunque esté inactivo). */
  proveedores: Proveedor[]
  configTasas: TasaSelectorConfig
  onClose: () => void
  /** Server Action (`editarCompraAction`). */
  onEditar: (values: EditarCompraValues) => Promise<EdicionCompraActionState>
  /** Tras guardar (la ficha refresca). */
  onEditada?: () => void
}

/** ¿El número tiene más de 2 decimales? (costo pactado de compras antiguas en USD). */
const masDeDosDecimales = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) > 1e-6

function valoresIniciales(d: DetalleCompra): EditarCompraInput {
  const c = d.compra
  return {
    compra_id: c.id,
    proveedor_id: c.proveedor.id,
    fecha: c.fecha.slice(0, 10),
    condicion: c.condicion,
    moneda: c.moneda,
    notas: c.notas ?? '',
    cambiar_tasa: false,
    tasa_origen: c.tasa_origen,
    tasa_fuente: c.tasa_fuente,
    tasa: c.tasa_snapshot,
    items: d.lineas.map((l) => ({ compra_item_id: l.id, peso_kg: l.peso_kg, costo_kg: l.costo_kg_pactado })),
    motivo: '',
  }
}

/**
 * Edición de una compra registrada (19, solo admin): proveedor, fecha,
 * condición, notas, moneda y tasa (`TasaSelector` tras "Cambiar tasa"), y kg
 * y costo/kg de cada línea (sin agregar ni quitar), con motivo obligatorio.
 * Vista previa en vivo con `previsualizarEdicionCompra` (la misma cuenta que
 * la RPC) y avisos según el caso. `AppDialog md`, pantalla completa en `xs`.
 * Montar con un `key` que cambie al abrir: cada apertura parte de los
 * valores vigentes.
 */
export function EditarCompraDialog({
  detalle,
  open,
  proveedores,
  configTasas,
  onClose,
  onEditar,
  onEditada,
}: EditarCompraDialogProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [referencial, setReferencial] = React.useState<ReferencialTasa | null>(null)
  // Referencial del día nuevo (D5), con la fecha a la que corresponde.
  const [referencialDia, setReferencialDia] = React.useState<{ fecha: string; valor: number | null } | null>(null)
  const enviandoRef = React.useRef(false)
  const { compra } = detalle
  const hoy = fechaHoy()

  const methods = useForm<EditarCompraInput, unknown, EditarCompraValues>({
    resolver: zodResolver(editarCompraSchema),
    mode: 'onSubmit',
    disabled: isPending,
    defaultValues: valoresIniciales(detalle),
  })
  const { control, register, handleSubmit, setError, setValue, formState } = methods
  const { errors } = formState
  const valores = useWatch({ control }) as EditarCompraInput

  // La page manda los activos y el actual (aunque esté inactivo).
  const opciones = proveedores
  const proveedor = opciones.find((p) => p.id === valores.proveedor_id) ?? null
  const cambiaProveedor = valores.proveedor_id !== compra.proveedor.id
  // D4: a crédito, el proveedor final no puede estar bloqueado si cambió el
  // proveedor o la condición pasa a crédito.
  const creditoBloqueado = !!proveedor?.bloqueado && (cambiaProveedor || compra.condicion !== 'credito')

  // D5: tope de fecha = hoy o la primera salida de sus lotes.
  const fechaMaxima =
    detalle.primera_salida && detalle.primera_salida.slice(0, 10) < hoy ? detalle.primera_salida.slice(0, 10) : hoy
  const cambiaFecha = valores.fecha !== compra.fecha.slice(0, 10)

  // D5: la tasa no cambia sola; si era referencial y la del día nuevo difiere, se avisa.
  const consultarDia =
    cambiaFecha &&
    !valores.cambiar_tasa &&
    compra.tasa_origen === 'referencial' &&
    /^\d{4}-\d{2}-\d{2}$/.test(valores.fecha ?? '')
  React.useEffect(() => {
    if (!consultarDia) return
    let vigente = true
    const fecha = valores.fecha
    const timer = setTimeout(async () => {
      const r = await getTasaVigenteAction({ fecha, fuente: compra.tasa_fuente ?? configTasas.fuente_tasa_default })
      if (vigente) setReferencialDia({ fecha, valor: r.valor })
    }, 300)
    return () => {
      vigente = false
      clearTimeout(timer)
    }
  }, [consultarDia, valores.fecha, compra.tasa_fuente, configTasas.fuente_tasa_default])
  const referencialDiaNuevo = consultarDia && referencialDia?.fecha === valores.fecha ? referencialDia.valor : null
  const tasaDiaDifiere =
    referencialDiaNuevo != null && Math.round(referencialDiaNuevo * 1e6) !== Math.round(compra.tasa_snapshot * 1e6)

  const vista = React.useMemo(
    () =>
      previsualizarEdicionCompra(detalle, {
        proveedor_id: valores.proveedor_id ?? compra.proveedor.id,
        proveedor_nombre: proveedor?.nombre ?? null,
        fecha: valores.fecha ?? compra.fecha,
        condicion: valores.condicion ?? compra.condicion,
        moneda: valores.moneda ?? compra.moneda,
        notas: valores.notas ?? '',
        cambiar_tasa: !!valores.cambiar_tasa,
        tasa_origen: valores.tasa_origen ?? compra.tasa_origen,
        tasa_fuente: valores.tasa_fuente ?? null,
        tasa: valores.tasa ?? null,
        items: (valores.items ?? []).map((i) => ({
          compra_item_id: i.compra_item_id,
          peso_kg: i.peso_kg ?? null,
          costo_kg: i.costo_kg ?? null,
        })),
      }),
    [detalle, valores, proveedor?.nombre, compra]
  )

  const alternarTasa = (activa: boolean) => {
    setValue('cambiar_tasa', activa, { shouldDirty: true })
    if (!activa) {
      // Sin cambiar la tasa, las cinco columnas quedan intactas.
      setValue('tasa_origen', compra.tasa_origen, { shouldDirty: true })
      setValue('tasa_fuente', compra.tasa_fuente, { shouldDirty: true })
      setValue('tasa', compra.tasa_snapshot, { shouldDirty: true })
      setReferencial(null)
    }
  }

  const enviar = (values: EditarCompraValues) => {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setServerError(null)
    startTransition(async () => {
      try {
        const r = await onEditar(values)
        if (r.error) {
          const campos = Object.entries(r.fieldErrors ?? {})
          setServerError(campos.length > 0 ? null : r.error)
          for (const [campo, mensaje] of campos) {
            setError(campo as keyof EditarCompraInput, { type: 'server', message: mensaje })
          }
          return
        }
        notify.success(r.success ?? `${tituloCompra(compra.fecha)} actualizada`)
        if (r.info) notify.info(r.info)
        onEditada?.()
        onClose()
      } finally {
        enviandoRef.current = false
      }
    })
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) =>
    handleSubmit(async (values) => {
      // Confirmación del umbral de desviación de la tasa manual (08-tasas).
      if (values.cambiar_tasa) {
        const ok = await pedirConfirmacionTasaManual(
          confirm,
          values,
          referencial,
          configTasas.umbral_desviacion_tasa_pct
        )
        if (!ok) return
      }
      enviar(values)
    })(e)

  const moneda = valores.moneda ?? compra.moneda
  const etiquetaMoneda = moneda === 'bs' ? 'Bs' : 'USD'

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      title="Editar compra"
      subtitle={`${tituloCompra(compra.fecha)} · ${compra.proveedor.nombre}`}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      onSubmit={onSubmit}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending} disabled={vista.sin_cambios || vista.bajo_minimo}>
          Guardar cambios
        </Button>
      }
    >
      <FormProvider {...methods}>
        <Box sx={{ display: 'grid', gap: 3 }}>
          <FormSection titulo="Datos de la compra" primera>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' } }}>
              <Controller
                control={control}
                name="proveedor_id"
                render={({ field }) => (
                  <Autocomplete
                    options={opciones}
                    value={proveedor}
                    onChange={(_, next) => field.onChange(next?.id ?? '')}
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                    disableClearable={!!proveedor}
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
                        <StatusChips bloqueado={p.bloqueado} motivoBloqueo={p.motivo_bloqueo} activo={p.activo} />
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Proveedor *"
                        size="small"
                        error={!!errors.proveedor_id}
                        helperText={errors.proveedor_id?.message}
                      />
                    )}
                  />
                )}
              />
              <TextField
                label="Fecha *"
                type="date"
                fullWidth
                size="small"
                {...register('fecha')}
                error={!!errors.fecha}
                helperText={
                  errors.fecha?.message ??
                  (detalle.primera_salida
                    ? `Máximo ${fechaCorta(fechaMaxima)}: primera salida de sus lotes`
                    : 'No puede ser futura')
                }
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: fechaMaxima } }}
              />
            </Box>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, alignItems: 'start' }}>
              <Box>
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
                      disabled={field.disabled}
                      onChange={(_, next) => next && field.onChange(next)}
                      aria-label="Condición de pago"
                    >
                      <ToggleButton value="contado">Contado</ToggleButton>
                      <ToggleButton value="credito">Crédito</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
              </Box>
              <TextField
                label="Notas"
                fullWidth
                size="small"
                multiline
                maxRows={3}
                {...register('notas')}
                error={!!errors.notas}
                helperText={errors.notas?.message}
              />
            </Box>

            {creditoBloqueado && valores.condicion === 'credito' ? (
              <Alert severity="warning">
                {proveedor?.nombre} está bloqueado
                {proveedor?.motivo_bloqueo ? ` (${proveedor.motivo_bloqueo})` : ''}: no se le puede comprar a crédito.
              </Alert>
            ) : null}
          </FormSection>

          <FormSection titulo="Moneda y tasa">
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, alignItems: 'start' }}>
              <Box>
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
                      disabled={field.disabled}
                      onChange={(_, next) => next && field.onChange(next)}
                      aria-label="Moneda de la compra"
                    >
                      <ToggleButton value="usd">USD</ToggleButton>
                      <ToggleButton value="bs">Bs</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
              </Box>
              <Box sx={{ display: 'grid', gap: 0.5 }}>
                <Typography variant="body2" sx={NUM}>
                  Tasa actual: {formatTasa(compra.tasa_snapshot)} · {textoProcedenciaTasa(compra)}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!valores.cambiar_tasa}
                      onChange={(e) => alternarTasa(e.target.checked)}
                      disabled={formState.disabled}
                    />
                  }
                  label="Cambiar tasa"
                />
              </Box>
            </Box>

            {tasaDiaDifiere && !valores.cambiar_tasa ? (
              <Alert
                severity="info"
                action={
                  <Button color="inherit" size="small" onClick={() => alternarTasa(true)}>
                    Cambiar tasa
                  </Button>
                }
              >
                La tasa referencial del {fechaCorta(valores.fecha)} es {formatTasa(referencialDiaNuevo ?? 0)}. ¿Quieres
                cambiarla? La tasa no cambia sola.
              </Alert>
            ) : null}

            <Collapse in={!!valores.cambiar_tasa} unmountOnExit>
              <TasaSelector
                fecha={/^\d{4}-\d{2}-\d{2}$/.test(valores.fecha ?? '') ? valores.fecha : hoy}
                config={configTasas}
                onReferencial={setReferencial}
                titulo="Tasa nueva"
              />
            </Collapse>
          </FormSection>

          <FormSection titulo="Líneas" ayuda="Solo kg y costo/kg: no se agregan ni quitan líneas.">
            <Box sx={{ display: 'grid', gap: 2 }}>
              {detalle.lineas.map((l, i) => {
                const previa = vista.lineas[i]
                const decimalesCosto = masDeDosDecimales(l.costo_kg_pactado) ? 6 : 2
                const errorPeso = errors.items?.[i]?.peso_kg?.message
                const errorCosto = errors.items?.[i]?.costo_kg?.message
                return (
                  <Box
                    key={l.id}
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1.4fr) 1fr 1fr' },
                      alignItems: 'start',
                    }}
                  >
                    <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {l.producto.nombre}
                      </Typography>
                      {l.lote ? (
                        <Box>
                          <LoteChip codigo={l.lote.codigo} />
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Sin control de stock
                        </Typography>
                      )}
                    </Box>
                    <Controller
                      control={control}
                      name={`items.${i}.peso_kg`}
                      render={({ field }) => (
                        <NumberField
                          label="Kg *"
                          fullWidth
                          size="small"
                          decimals={3}
                          suffix="kg"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={field.disabled}
                          error={!!errorPeso || !!previa?.bajo_minimo}
                          helperText={
                            errorPeso ??
                            (previa && previa.minimo_kg > 0
                              ? `Mínimo ${formatKg(previa.minimo_kg)}: ya consumidos`
                              : `Actual: ${formatKg(l.peso_kg)}`)
                          }
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`items.${i}.costo_kg`}
                      render={({ field }) => (
                        <NumberField
                          label={`Costo/kg (${etiquetaMoneda}) *`}
                          fullWidth
                          size="small"
                          decimals={decimalesCosto}
                          prefix={moneda === 'usd' ? '$' : undefined}
                          suffix={moneda === 'bs' ? 'Bs' : undefined}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={field.disabled}
                          error={!!errorCosto}
                          helperText={errorCosto ?? `Actual: ${formatMoneda(l.costo_kg_pactado, compra.moneda)}`}
                        />
                      )}
                    />
                  </Box>
                )
              })}
            </Box>
          </FormSection>

          <FormSection titulo="Motivo">
            <TextField
              label="Motivo *"
              fullWidth
              size="small"
              multiline
              minRows={2}
              maxRows={5}
              placeholder="Ej. el costo se capturó en USD y era en Bs"
              {...register('motivo')}
              error={!!errors.motivo}
              helperText={errors.motivo?.message ?? 'Entre 5 y 500 caracteres. Solo lo ve el administrador.'}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
          </FormSection>

          {/* Vista previa en vivo */}
          <Box aria-live="polite" sx={{ p: 2, borderRadius: 1, bgcolor: 'action.hover', display: 'grid', gap: 1.5 }}>
            <Typography variant="subtitle2" component="p">
              Vista previa
            </Typography>
            <Box
              component="dl"
              sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5 }}
            >
              {vista.lineas.map((l) => (
                <FilaPrevia
                  key={l.compra_item_id}
                  label={l.lote_codigo ?? l.producto_nombre}
                  valor={`${formatUsd(l.costo_antes_usd_kg)}/kg → ${formatUsd(l.costo_despues_usd_kg)}/kg${
                    l.delta_kg !== 0 ? ` · ${l.delta_kg > 0 ? '+' : '−'}${formatKg(Math.abs(l.delta_kg))}` : ''
                  }`}
                  color={l.bajo_minimo ? 'error.main' : undefined}
                />
              ))}
              <FilaPrevia
                label="Total"
                valor={`${formatUsd(vista.antes.total_usd)} → ${formatUsd(vista.despues.total_usd)}`}
                fuerte
              />
              <FilaPrevia
                label="Pagado"
                valor={`${formatUsd(vista.antes.pagado_usd)} → ${formatUsd(vista.despues.pagado_usd)}`}
              />
              {vista.despues.saldo_a_favor_usd > 0 ? (
                <FilaPrevia
                  label="Saldo a favor del negocio"
                  valor={formatUsd(vista.despues.saldo_a_favor_usd)}
                  color="success.main"
                  fuerte
                />
              ) : (
                <FilaPrevia
                  label="Saldo"
                  valor={`${formatUsd(vista.antes.saldo_usd)} → ${formatUsd(vista.despues.saldo_usd)}`}
                />
              )}
              <FilaPrevia
                label="Estado"
                valor={`${vista.antes.estado === 'pagada' ? 'Pagada' : 'Por pagar'} → ${
                  vista.despues.estado === 'pagada' ? 'Pagada' : 'Por pagar'
                }`}
              />
            </Box>

            {vista.cambia_costo && (vista.hijos.length > 0 || vista.costo_vendido.lineas > 0) ? (
              <Box sx={{ display: 'grid', gap: 0.5 }}>
                {vista.hijos
                  .filter((h) => h.costo_antes_usd_kg !== h.costo_despues_usd_kg)
                  .map((h) => (
                    <Typography key={h.lote_id} variant="body2" sx={NUM}>
                      {h.codigo} ({h.producto_nombre}): {formatUsd(h.costo_antes_usd_kg)}/kg →{' '}
                      {formatUsd(h.costo_despues_usd_kg)}/kg
                    </Typography>
                  ))}
                {vista.costo_vendido.lineas > 0 ? (
                  <Typography variant="body2" sx={NUM}>
                    Costo de lo vendido: {formatUsd(vista.costo_vendido.antes_usd)} →{' '}
                    {formatUsd(vista.costo_vendido.despues_usd)} ({vista.costo_vendido.lineas}{' '}
                    {vista.costo_vendido.lineas === 1 ? 'línea' : 'líneas'} en {vista.costo_vendido.facturas}{' '}
                    {vista.costo_vendido.facturas === 1 ? 'factura' : 'facturas'}). Los precios y totales de las facturas
                    no cambian.
                  </Typography>
                ) : null}
              </Box>
            ) : null}
          </Box>

          {vista.avisos.map((a) => (
            <Alert key={`${a.tipo}-${a.mensaje}`} severity={a.severidad}>
              {a.mensaje}
            </Alert>
          ))}
        </Box>
      </FormProvider>
    </AppDialog>
  )
}
