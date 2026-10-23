'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { AppDialog } from '@/components/organisms/AppDialog'
import { FormSection } from '@/components/molecules/FormSection'
import { NumberField } from '@/components/atoms/NumberField'
import { PhoneField } from '@/components/atoms/PhoneField'
import { CotizacionItemsFieldArray, cotizacionItemVacio } from '@/components/molecules/CotizacionItemsFieldArray'
import {
  cotizacionFormSchema,
  type CotizacionFormInput,
  type CotizacionFormValues,
} from '@/lib/cotizacionValidation'
import { totalesCotizacion } from '@/lib/cotizaciones/totales'
import { sumarDias } from '@/lib/cotizaciones/estado'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import {
  valoresDesdeDetalle,
  valoresNuevaCotizacion,
  type DefaultsFormCotizacion,
  type ModoCotizacionForm,
} from '@/lib/cotizaciones/formulario'
import { etiquetaIva, formatIvaPct, ivaPctVenta } from '@/lib/facturas/iva'
import { formatFecha, formatUsd } from '@/lib/format'
import { useNotify } from '@/lib/useNotify'
import { guardarCotizacionAction } from '@/app/(protected)/cotizaciones/actions'
import type { Cliente, CotizacionDetalle, Producto } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

const TITULO: Record<ModoCotizacionForm, string> = {
  crear: 'Nueva cotización',
  editar: 'Editar cotización',
  duplicar: 'Duplicar cotización',
  renovar: 'Renovar cotización',
}

const PRIMARIO: Record<ModoCotizacionForm, string> = {
  crear: 'Crear cotización',
  editar: 'Guardar cambios',
  duplicar: 'Crear borrador',
  renovar: 'Renovar',
}

export interface CotizacionFormProps {
  open: boolean
  modo: ModoCotizacionForm
  /** Cotización de origen (editar, duplicar, renovar); `null` al crear. */
  cotizacion: CotizacionDetalle | null
  clientes: Cliente[]
  productos: Producto[]
  /** `config_negocio.iva_pct` vigente (el % si el interruptor está en sí, P1). */
  ivaPct: number
  /** Validez y términos por defecto de `config_negocio`. */
  defaults: DefaultsFormCotizacion
  /** Hoy en Venezuela (del servidor). */
  hoy: string
  onClose: () => void
  /** Tras guardar: id de la cotización creada o editada. */
  onGuardada?: (id: string) => void
}

/**
 * Formulario de una cotización (21-cotizaciones), `AppDialog md`
 * (`fullScreen` en `xs`). Modos `crear` / `editar` / `duplicar` / `renovar`.
 * Cliente registrado (Autocomplete, aviso si está bloqueado) o libre (nombre
 * + teléfono); líneas con precio precargado (P9); interruptor de IVA
 * precargado con `aplica_iva` del cliente (P1); descuento global en USD (P2);
 * resumen en vivo solo en USD; fecha (máx. hoy) y validez con su
 * vencimiento. Los errores de la base (`hint`) caen en su campo.
 *
 * Los valores iniciales se toman al montar: el padre cambia la `key` en
 * cada apertura (otra cotización u otro modo).
 */
export function CotizacionForm({
  open,
  modo,
  cotizacion,
  clientes,
  productos,
  ivaPct,
  defaults,
  hoy,
  onClose,
  onGuardada,
}: CotizacionFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const valoresIniciales = React.useMemo<CotizacionFormInput>(() => {
    if (modo === 'crear' || !cotizacion) {
      const v = valoresNuevaCotizacion(defaults, hoy)
      return { ...v, items: [cotizacionItemVacio()] }
    }
    return valoresDesdeDetalle(cotizacion, modo, hoy)
  }, [modo, cotizacion, defaults, hoy])

  const methods = useForm<CotizacionFormInput, unknown, CotizacionFormValues>({
    resolver: zodResolver(cotizacionFormSchema),
    mode: 'onSubmit',
    defaultValues: valoresIniciales,
    disabled: isPending,
  })
  const { control, handleSubmit, setError, setValue, formState } = methods

  const [tipoCliente, clienteId, conIva, items, descuento, fecha, validez] = useWatch({
    control,
    name: ['tipo_cliente', 'cliente_id', 'con_iva', 'items', 'descuento_usd', 'fecha', 'validez_dias'],
  })
  const cliente = clientes.find((c) => c.id === clienteId) ?? null
  // Productos del formulario: activos + los de la cotización de origen (aunque ya no lo estén).
  const productosForm = React.useMemo(() => {
    const ids = new Set(cotizacion?.items.map((i) => i.producto_id) ?? [])
    return productos.filter((p) => p.activo || ids.has(p.id))
  }, [productos, cotizacion])

  const ivaEfectivo = ivaPctVenta(conIva, ivaPct)
  const totales = totalesCotizacion(items ?? [], descuento ?? 0, ivaEfectivo)
  const vencimiento =
    fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && validez && validez >= 1 && validez <= 90
      ? sumarDias(fecha, validez)
      : null

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const id = modo === 'editar' || modo === 'renovar' ? (cotizacion?.id ?? null) : null
      const r = await guardarCotizacionAction(modo, id, values)
      if (r.error) {
        setServerError(r.error)
        for (const [campo, mensaje] of Object.entries(r.fieldErrors ?? {})) {
          setError(campo as FieldPath<CotizacionFormInput>, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(r.success ?? 'Cotización guardada')
      onClose()
      if (r.id) onGuardada?.(r.id)
    })
  })

  const subtitulo =
    cotizacion && modo !== 'crear'
      ? modo === 'duplicar'
        ? `Copia de ${formatNumeroCotizacion(cotizacion.numero)}: se crea un borrador nuevo, sin enlace`
        : modo === 'renovar'
          ? `${formatNumeroCotizacion(cotizacion.numero)}: fecha de hoy y validez nueva; el enlace se conserva`
          : formatNumeroCotizacion(cotizacion.numero)
      : undefined

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      title={TITULO[modo]}
      subtitle={subtitulo}
      onSubmit={onSubmit}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending} disabled={productosForm.length === 0}>
          {PRIMARIO[modo]}
        </Button>
      }
    >
      <FormProvider {...methods}>
        <Box sx={{ display: 'grid', gap: 3 }}>
          <FormSection titulo="Cliente" primera>
            <Controller
              control={control}
              name="tipo_cliente"
              render={({ field }) => (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={field.value}
                  disabled={field.disabled}
                  onChange={(_, next: 'registrado' | 'libre' | null) => {
                    if (!next) return
                    field.onChange(next)
                    if (next === 'libre') {
                      setValue('cliente_id', null, { shouldDirty: true })
                      setValue('con_iva', true, { shouldDirty: true })
                    } else {
                      setValue('cliente_nombre', '', { shouldDirty: true })
                      setValue('cliente_telefono', '', { shouldDirty: true })
                    }
                  }}
                  aria-label="Tipo de cliente"
                  sx={{ justifySelf: 'start' }}
                >
                  <ToggleButton value="registrado">Cliente registrado</ToggleButton>
                  <ToggleButton value="libre">Cliente libre</ToggleButton>
                </ToggleButtonGroup>
              )}
            />
            {tipoCliente === 'registrado' ? (
              <Controller
                control={control}
                name="cliente_id"
                render={({ field }) => (
                  <Autocomplete
                    options={clientes}
                    value={cliente}
                    disabled={field.disabled}
                    onChange={(_, next) => {
                      field.onChange(next?.id ?? null)
                      // P1: el IVA se precarga con el "Aplica IVA" del cliente (editable).
                      setValue('con_iva', next?.aplica_iva ?? true, { shouldDirty: true })
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
                        {c.bloqueado ? <Chip label="Bloqueado" size="small" variant="soft" color="error" /> : null}
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Cliente *"
                        size="small"
                        error={!!formState.errors.cliente_id}
                        helperText={formState.errors.cliente_id?.message}
                      />
                    )}
                  />
                )}
              />
            ) : (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <Controller
                    control={control}
                    name="cliente_nombre"
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Nombre del cliente *"
                        fullWidth
                        size="small"
                        error={!!formState.errors.cliente_nombre}
                        helperText={formState.errors.cliente_nombre?.message}
                        slotProps={{ htmlInput: { maxLength: 120 } }}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="cliente_telefono"
                    render={({ field }) => (
                      <PhoneField
                        label="Teléfono (WhatsApp)"
                        fullWidth
                        size="small"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={field.disabled}
                        error={!!formState.errors.cliente_telefono}
                        helperText={formState.errors.cliente_telefono?.message ?? 'Opcional'}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            )}
            {cliente?.bloqueado ? (
              <Alert severity="warning">
                {cliente.nombre} está bloqueado (no se le vende a crédito). Puedes cotizarle igual.
              </Alert>
            ) : null}
          </FormSection>

          <FormSection titulo="Productos">
            <CotizacionItemsFieldArray productos={productosForm} />
          </FormSection>

          <FormSection titulo="Totales">
            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'grid', gap: 2 }}>
                <Controller
                  control={control}
                  name="con_iva"
                  render={({ field }) => (
                    <Box sx={{ display: 'grid', gap: 0.25 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            disabled={field.disabled}
                          />
                        }
                        label={`Con IVA (${formatIvaPct(ivaPct)})`}
                        sx={{ mr: 0, alignSelf: 'flex-start' }}
                      />
                      {cliente && field.value !== cliente.aplica_iva ? (
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Este cliente normalmente {cliente.aplica_iva ? 'sí' : 'no'} lleva IVA
                        </Typography>
                      ) : null}
                    </Box>
                  )}
                />
                <Controller
                  control={control}
                  name="descuento_usd"
                  render={({ field }) => (
                    <NumberField
                      label="Descuento (USD)"
                      size="small"
                      decimals={2}
                      prefix="$"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={field.disabled}
                      error={!!formState.errors.descuento_usd}
                      helperText={formState.errors.descuento_usd?.message ?? 'Sobre el subtotal; el IVA se calcula después'}
                      sx={{ maxWidth: 260 }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box
                  component="dl"
                  aria-label="Resumen de la cotización"
                  sx={{
                    m: 0,
                    ml: { sm: 'auto' },
                    display: 'grid',
                    gridTemplateColumns: 'auto auto',
                    columnGap: 3,
                    rowGap: 0.5,
                    justifyContent: { xs: 'stretch', sm: 'end' },
                    '& dt': { typography: 'body2', color: 'text.secondary' },
                    '& dd': { m: 0, typography: 'body2', textAlign: 'right', ...NUM },
                  }}
                >
                  <dt>Subtotal</dt>
                  <dd>{formatUsd(totales.subtotal_usd)}</dd>
                  {totales.descuento_usd > 0 ? (
                    <>
                      <dt>Descuento</dt>
                      <dd>−{formatUsd(totales.descuento_usd)}</dd>
                    </>
                  ) : null}
                  <dt>{etiquetaIva(ivaEfectivo)}</dt>
                  <dd>{ivaEfectivo > 0 ? formatUsd(totales.iva_usd) : '—'}</dd>
                  <Box component="dt" sx={{ typography: 'subtitle1', color: 'text.primary', fontWeight: 700 }}>
                    Total USD
                  </Box>
                  <Box component="dd" sx={{ typography: 'subtitle1', fontWeight: 700 }}>
                    {formatUsd(totales.total_usd)}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </FormSection>

          <FormSection titulo="Condiciones">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="fecha"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Fecha *"
                      type="date"
                      fullWidth
                      size="small"
                      disabled={field.disabled || modo === 'renovar'}
                      error={!!formState.errors.fecha}
                      helperText={formState.errors.fecha?.message ?? (modo === 'renovar' ? 'Renovar usa la fecha de hoy' : undefined)}
                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="validez_dias"
                  render={({ field }) => (
                    <NumberField
                      label="Validez *"
                      fullWidth
                      size="small"
                      decimals={0}
                      suffix="días"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={field.disabled}
                      error={!!formState.errors.validez_dias}
                      helperText={
                        formState.errors.validez_dias?.message ??
                        (vencimiento ? `Vence el ${formatFecha(vencimiento)}` : 'De 1 a 90 días')
                      }
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <Controller
                  control={control}
                  name="notas_cliente"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Notas para el cliente"
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      error={!!formState.errors.notas_cliente}
                      helperText={formState.errors.notas_cliente?.message ?? 'Salen en el PDF y en el enlace'}
                      slotProps={{ htmlInput: { maxLength: 1000 } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <Controller
                  control={control}
                  name="terminos"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Términos y condiciones"
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      error={!!formState.errors.terminos}
                      helperText={formState.errors.terminos?.message}
                      slotProps={{ htmlInput: { maxLength: 2000 } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <Controller
                  control={control}
                  name="notas_internas"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Notas internas"
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      error={!!formState.errors.notas_internas}
                      helperText={formState.errors.notas_internas?.message ?? 'Solo interno: nunca sale en el PDF ni en el enlace'}
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </FormSection>
        </Box>
      </FormProvider>
    </AppDialog>
  )
}
