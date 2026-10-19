'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch, type Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { LoteAutocomplete } from '@/components/molecules/LoteAutocomplete'
import {
  SalidasProcesoFieldArray,
  salidaVacia,
} from '@/components/molecules/SalidasProcesoFieldArray'
import { AppDialog } from '@/components/organisms/AppDialog'
import {
  precioEfectivo,
  procesamientoFormSchema,
  sumaSalidasKg,
  validarPreciosSalidas,
  type ProcesamientoFormInput,
  type ProcesamientoFormValues,
} from '@/lib/procesamientoValidation'
import { TOLERANCIA_KG } from '@/lib/loteValidation'
import { repartirCostoProceso } from '@/lib/services/costingService'
import { fechaHoy, formatKg, formatPct, formatUsd } from '@/lib/format'
import type { Lote, LoteCreado, Producto } from '@/types/domain'
import { crearProcesamientoAction } from '@/app/(protected)/procesamiento/actions'
import { useNotify } from '@/lib/useNotify'

const NUM = { fontVariantNumeric: 'tabular-nums' }

/** Producto crudo con su stock (Σ de sus lotes abiertos). */
export interface CrudoConStock {
  producto: Producto
  stock_kg: number
}

export interface ProcesamientoFormProps {
  open: boolean
  onClose: () => void
  /** Crudos activos con stock actual. */
  crudos: CrudoConStock[]
  /**
   * Procesados activos; cada uno indica su crudo en `producto_origen_id` y
   * su precio de referencia (no es costo: lo ven todos).
   */
  procesados: Producto[]
  /**
   * Lotes abiertos con stock de los crudos, en orden PEPS (07-lotes).
   * `costo_usd_kg` llega `null` al operador: sin él no se muestra ningún costo.
   */
  lotes: Lote[]
  /** `config_negocio.dias_alerta_lote`. */
  diasAlertaLote: number | null
  /** Procesamiento registrado: los N lotes creados, para rotular. */
  onCreated?: (lotes: LoteCreado[]) => void
}

function vacio(): ProcesamientoFormInput {
  return {
    fecha: fechaHoy(),
    producto_origen_id: '',
    lote_origen_id: '',
    peso_entrada_kg: null,
    salidas: [salidaVacia()],
    notas: '',
  }
}

const etiqueta = (p: Producto) => (p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre)

/**
 * Registro de una limpieza (16): un lote crudo (se preselecciona el más
 * antiguo) pesado a la entrada → N salidas de procesados distintos, cada una
 * un lote nuevo ligado a su padre. Merma y rendimiento del proceso completo
 * en vivo; el costo repartido por valor de venta solo se muestra si se
 * conoce el costo del lote (admin). Montar con un `key` que cambie al abrir.
 */
export function ProcesamientoForm({
  open,
  onClose,
  crudos,
  procesados,
  lotes,
  diasAlertaLote,
  onCreated,
}: ProcesamientoFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  // Copia síncrona: dos clics antes del re-render deben ver el primero.
  const submittingRef = React.useRef(false)

  const methods = useForm<ProcesamientoFormInput, unknown, ProcesamientoFormValues>({
    resolver: zodResolver(procesamientoFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(),
    disabled: isPending,
  })
  const { control, register, handleSubmit, setError, setValue, formState } = methods
  const { errors } = formState

  const [origenId, loteId, entrada, salidas] = useWatch({
    control,
    name: ['producto_origen_id', 'lote_origen_id', 'peso_entrada_kg', 'salidas'],
  })
  const origen = crudos.find((c) => c.producto.id === origenId) ?? null
  const destinos = React.useMemo(
    () => (origen ? procesados.filter((p) => p.producto_origen_id === origen.producto.id) : []),
    [origen, procesados]
  )
  const lotesDeOrigen = origen ? lotes.filter((l) => l.producto_id === origen.producto.id) : []
  const lote = lotesDeOrigen.find((l) => l.id === loteId) ?? null
  /** Lo que queda en el lote es lo que normalmente se limpia: se precarga y se puede editar. */
  const pesoSugerido = lote && lote.stock_kg > 0 ? lote.stock_kg : null

  const elegirLote = (nuevo: Lote | null) => {
    setValue('lote_origen_id', nuevo?.id ?? '', { shouldDirty: true })
    setValue('peso_entrada_kg', nuevo && nuevo.stock_kg > 0 ? nuevo.stock_kg : null, {
      shouldDirty: true,
    })
  }

  const elegirOrigen = (id: string) => {
    const suyos = procesados.filter((p) => p.producto_origen_id === id)
    // PEPS: se preselecciona el lote más antiguo (llegan ordenados).
    elegirLote(lotes.find((l) => l.producto_id === id) ?? null)
    // Con un solo procesado posible se precarga la primera fila.
    setValue('salidas', [salidaVacia(suyos.length === 1 ? suyos[0].id : '')], {
      shouldDirty: true,
    })
  }

  // ---------- Resumen en vivo ----------
  const filas = salidas ?? []
  const entradaValida = entrada != null && entrada > 0 ? entrada : null
  const salidaTotal = sumaSalidasKg(filas)
  const pesosCompletos = filas.length > 0 && filas.every((s) => s.peso_salida_kg != null && s.peso_salida_kg > 0)
  const salidaExcede = entradaValida != null && salidaTotal > entradaValida + TOLERANCIA_KG
  const excedeStock = lote != null && entrada != null && entrada > lote.stock_kg + TOLERANCIA_KG
  const faltanPrecios =
    Object.keys(
      validarPreciosSalidas(
        filas.map((s) => ({
          producto_destino_id: s.producto_destino_id,
          precio_referencia_usd_kg: s.precio_referencia_usd_kg ?? null,
        })),
        destinos
      )
    ).length > 0
  const calculoValido = entradaValida != null && pesosCompletos && !salidaExcede

  const costoLote = lote?.costo_usd_kg ?? null
  const reparto =
    calculoValido && costoLote != null && !faltanPrecios
      ? repartirCostoProceso({
          pesoEntradaKg: entradaValida,
          costoLoteUsdKg: Number(costoLote),
          salidas: filas.map((s) => ({
            kg: s.peso_salida_kg ?? 0,
            precio: s.producto_destino_id
              ? precioEfectivo(
                  {
                    producto_destino_id: s.producto_destino_id,
                    precio_referencia_usd_kg: s.precio_referencia_usd_kg ?? null,
                  },
                  destinos
                ).precio
              : null,
          })),
        })
      : null
  const mermaKg = calculoValido ? Math.round((entradaValida - salidaTotal) * 1000) / 1000 : null

  const guardar = (values: ProcesamientoFormValues) => {
    if (submittingRef.current) return
    // Con ≥ 2 salidas, toda salida necesita precio (catálogo o formulario).
    const erroresPrecio = validarPreciosSalidas(values.salidas, procesados)
    const indices = Object.keys(erroresPrecio)
    if (indices.length > 0) {
      for (const i of indices) {
        setError(`salidas.${Number(i)}.precio_referencia_usd_kg`, {
          type: 'validate',
          message: erroresPrecio[Number(i)],
        })
      }
      return
    }

    submittingRef.current = true
    setServerError(null)
    const varias = values.salidas.length >= 2
    const payload: ProcesamientoFormValues = {
      ...values,
      // El precio solo viaja si hace falta: con una salida no se usa y, si el
      // catálogo tiene uno, la base usa ese.
      salidas: values.salidas.map((s) => ({
        ...s,
        precio_referencia_usd_kg:
          varias && precioEfectivo(s, procesados).delCatalogo === false
            ? s.precio_referencia_usd_kg
            : null,
      })),
    }
    const formData = new FormData()
    formData.set('payload', JSON.stringify(payload))

    startTransition(async () => {
      try {
        const result = await crearProcesamientoAction({ error: null, success: null }, formData)
        if (result.error) {
          setServerError(result.error)
          for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
            setError(campo as Path<ProcesamientoFormInput>, { type: 'server', message: mensaje })
          }
          return
        }
        notify.success(result.success ?? 'Procesamiento registrado')
        onClose()
        onCreated?.(result.lotes ?? [])
      } finally {
        submittingRef.current = false
      }
    })
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit(guardar)(e)

  const sinProductos = crudos.length === 0 || procesados.length === 0

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      title="Nuevo procesamiento"
      subtitle="Un lote crudo, un peso de entrada y lo que salió de él"
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      onSubmit={onSubmit}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending} disabled={sinProductos}>
          Registrar procesamiento
        </Button>
      }
    >
      <FormProvider {...methods}>
        <Box sx={{ display: 'grid', gap: 3 }}>
          {sinProductos ? (
            <Alert severity="info">
              Hace falta al menos un producto crudo y uno procesado activos. Créalos en Catálogos.
            </Alert>
          ) : null}

          <TextField
            label="Fecha *"
            type="date"
            size="small"
            sx={{ maxWidth: { sm: 220 } }}
            {...register('fecha')}
            error={!!errors.fecha}
            helperText={errors.fecha?.message}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="h6">Entrada (crudo)</Typography>
            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="producto_origen_id"
                  render={({ field }) => (
                    <TextField
                      select
                      label="Producto crudo *"
                      fullWidth
                      size="small"
                      value={field.value}
                      disabled={field.disabled}
                      onChange={(e) => {
                        field.onChange(e)
                        elegirOrigen(e.target.value)
                      }}
                      onBlur={field.onBlur}
                      error={!!errors.producto_origen_id}
                      helperText={
                        errors.producto_origen_id?.message ??
                        (origen
                          ? `En stock: ${formatKg(origen.stock_kg)} en ${lotesDeOrigen.length} ${
                              lotesDeOrigen.length === 1 ? 'lote' : 'lotes'
                            }`
                          : undefined)
                      }
                    >
                      {crudos.map((c) => (
                        <MenuItem key={c.producto.id} value={c.producto.id}>
                          <Box
                            sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, width: '100%' }}
                          >
                            <span>{etiqueta(c.producto)}</span>
                            <Typography variant="body2" color="text.secondary" sx={NUM}>
                              {formatKg(c.stock_kg)}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="lote_origen_id"
                  render={({ field }) => (
                    <LoteAutocomplete
                      lotes={lotesDeOrigen}
                      value={field.value || null}
                      onChange={elegirLote}
                      onBlur={field.onBlur}
                      diasAlertaLote={diasAlertaLote}
                      disabled={!origen || field.disabled}
                      error={!!errors.lote_origen_id || (!!origen && lotesDeOrigen.length === 0)}
                      helperText={
                        errors.lote_origen_id?.message ??
                        (!origen
                          ? 'Primero elige el crudo'
                          : lotesDeOrigen.length === 0
                            ? 'No hay lotes con stock de este crudo'
                            : undefined)
                      }
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="peso_entrada_kg"
                  render={({ field }) => (
                    <NumberField
                      label="Peso de entrada *"
                      fullWidth
                      size="small"
                      decimals={3}
                      suffix="kg"
                      value={field.value}
                      disabled={field.disabled}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={!!errors.peso_entrada_kg || excedeStock}
                      helperText={
                        errors.peso_entrada_kg?.message ??
                        (excedeStock ? `El lote solo tiene ${formatKg(lote?.stock_kg ?? 0)}` : undefined)
                      }
                    />
                  )}
                />
                {pesoSugerido != null && entrada !== pesoSugerido ? (
                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    disabled={isPending}
                    onClick={() => setValue('peso_entrada_kg', pesoSugerido, { shouldDirty: true })}
                  >
                    Usar todo el lote ({formatKg(pesoSugerido)})
                  </Link>
                ) : null}
              </Grid>
            </Grid>
          </Box>

          <SalidasProcesoFieldArray
            destinos={destinos}
            entradaKg={entradaValida}
            costos={reparto?.salidas ?? null}
            sinOrigen={!origen}
          />

          {origen && destinos.length === 0 ? (
            <Alert severity="warning">
              {origen.producto.nombre} no tiene procesados asignados. Asígnalos en Catálogos.
            </Alert>
          ) : null}

          <TextField
            label="Notas"
            fullWidth
            size="small"
            multiline
            maxRows={3}
            {...register('notas')}
            placeholder="Ej. fileteado, descamado"
          />

          {salidaExcede ? (
            <Alert severity="error">
              Las salidas suman {formatKg(salidaTotal)} y superan la entrada (
              {formatKg(entradaValida ?? 0)}).
            </Alert>
          ) : faltanPrecios ? (
            <Alert severity="warning">
              Con varias salidas, cada una necesita su precio de referencia para repartir el costo.
            </Alert>
          ) : null}

          <Box
            sx={{
              borderTop: '1px solid',
              borderColor: 'divider',
              pt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: `repeat(${reparto ? 5 : 4}, auto)` },
              justifyContent: { sm: 'end' },
              columnGap: 4,
              rowGap: 1,
            }}
          >
            <Resumen label="Salidas" value={pesosCompletos ? formatKg(salidaTotal) : '—'} />
            <Resumen label="Merma" value={mermaKg != null ? formatKg(mermaKg) : '—'} />
            <Resumen
              label="Merma %"
              value={mermaKg != null && entradaValida ? formatPct(mermaKg / entradaValida) : '—'}
            />
            <Resumen
              label="Rendimiento"
              value={calculoValido && entradaValida ? formatPct(salidaTotal / entradaValida) : '—'}
              destacado
            />
            {reparto ? (
              <Resumen label="Costo total" value={formatUsd(reparto.costo_total_usd)} destacado />
            ) : null}
          </Box>

          {reparto && lote ? (
            <Typography variant="caption" color="text.secondary">
              Costo del lote {lote.codigo} ({formatUsd(reparto.costo_total_usd)} a{' '}
              {formatUsd(Number(costoLote))}/kg) repartido{' '}
              {reparto.reparto === 'valor'
                ? 'por valor de venta (kg × precio de referencia).'
                : filas.length === 1
                  ? 'completo a la única salida.'
                  : 'por peso: todos los precios de referencia son 0.'}
            </Typography>
          ) : null}
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
      <Typography variant={destacado ? 'h6' : 'body2'} sx={NUM}>
        {value}
      </Typography>
    </Box>
  )
}
