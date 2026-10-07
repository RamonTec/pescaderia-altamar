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
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { NumberField } from '@/components/atoms/NumberField'
import { LoteAutocomplete } from '@/components/molecules/LoteAutocomplete'
import {
  procesamientoFormSchema,
  type ProcesamientoFormInput,
  type ProcesamientoFormValues,
} from '@/lib/procesamientoValidation'
import { costoDestino } from '@/lib/services/costingService'
import { fechaHoy, formatKg, formatUsd } from '@/lib/format'
import type { Lote, LoteCreado, Producto } from '@/types/domain'
import { crearProcesamientoAction } from '@/app/(protected)/procesamiento/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

const NUM = { fontVariantNumeric: 'tabular-nums' }

const pctFormatter = new Intl.NumberFormat('es-VE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

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
  /** Procesados activos; cada uno indica su crudo en `producto_origen_id`. */
  procesados: Producto[]
  /**
   * Lotes abiertos con stock de los crudos, en orden PEPS (07-lotes).
   * `costo_usd_kg` llega `null` al operador.
   */
  lotes: Lote[]
  /** `config_negocio.dias_alerta_lote`. */
  diasAlertaLote: number | null
  /** Procesamiento registrado: el lote procesado creado, para rotular. */
  onCreated?: (lotes: LoteCreado[]) => void
}

const VACIO: Omit<ProcesamientoFormInput, 'fecha'> = {
  producto_origen_id: '',
  lote_origen_id: '',
  peso_entrada_kg: null,
  producto_destino_id: '',
  peso_salida_kg: null,
  notas: '',
}

const etiqueta = (p: Producto) => (p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre)

/**
 * Registro de una limpieza por lote (07-lotes): crudo → lote crudo elegido
 * (se preselecciona el más antiguo) pesado a la entrada → procesado pesado a
 * la salida, que nace como un lote nuevo ligado a su padre. Merma y
 * rendimiento se calculan en vivo; el costo resultante del kg procesado solo
 * se muestra si se conoce el costo del lote (admin). Montar con un `key` que
 * cambie al abrir.
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
  const confirm = useConfirm()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    ProcesamientoFormInput,
    unknown,
    ProcesamientoFormValues
  >({
    resolver: zodResolver(procesamientoFormSchema),
    mode: 'onSubmit',
    defaultValues: { ...VACIO, fecha: fechaHoy() },
  })
  const { errors } = formState

  const [origenId, loteId, entrada, salida] = useWatch({
    control,
    name: ['producto_origen_id', 'lote_origen_id', 'peso_entrada_kg', 'peso_salida_kg'],
  })
  const origen = crudos.find((c) => c.producto.id === origenId) ?? null
  const destinos = origen ? procesados.filter((p) => p.producto_origen_id === origen.producto.id) : []
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
    // Con un solo procesado posible se elige solo; si no, se vuelve a pedir.
    setValue('producto_destino_id', suyos.length === 1 ? suyos[0].id : '', { shouldDirty: true })
  }

  const pesosValidos = entrada != null && entrada > 0 && salida != null && salida > 0
  const salidaExcede = pesosValidos && salida > entrada
  const costoLote = lote?.costo_usd_kg ?? null
  const calculo = pesosValidos ? costoDestino(entrada, costoLote ?? 0, salida) : null
  const excedeStock = lote != null && entrada != null && entrada > lote.stock_kg + 0.0005

  const pedirCierre = async () => {
    if (formState.isDirty) {
      const ok = await confirm({
        title: '¿Descartar el procesamiento?',
        message: 'Hay datos sin guardar. ¿Descartarlos?',
        confirmLabel: 'Descartar',
        destructive: true,
      })
      if (!ok) return
    }
    onClose()
  }

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    const formData = new FormData()
    formData.set('payload', JSON.stringify(values))

    startTransition(async () => {
      const result = await crearProcesamientoAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          setError(campo as keyof ProcesamientoFormInput, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Procesamiento registrado')
      onClose()
      onCreated?.(result.lotes ?? [])
    })
  })

  const sinProductos = crudos.length === 0 || procesados.length === 0

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : pedirCierre}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <Box component="form" onSubmit={onSubmit} noValidate>
        <DialogTitle>Nuevo procesamiento</DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 3 }}>
            {sinProductos ? (
              <Alert severity="info">
                Hace falta al menos un producto crudo y uno procesado activos. Créalos en
                Catálogos.
              </Alert>
            ) : null}

            <TextField
              label="Fecha *"
              type="date"
              sx={{ maxWidth: { sm: 220 } }}
              {...register('fecha')}
              error={!!errors.fecha}
              helperText={errors.fecha?.message}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Box sx={{ display: 'grid', gap: 2 }}>
              <Typography variant="h6">Entrada (crudo)</Typography>
              <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
                <Grid size={{ xs: 12, sm: 6 }}>
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
                <Grid size={{ xs: 12, sm: 6 }}>
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
                        disabled={!origen}
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
                <Grid size={{ xs: 12, sm: 6 }}>
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
                      onClick={() =>
                        setValue('peso_entrada_kg', pesoSugerido, { shouldDirty: true })
                      }
                    >
                      Usar todo el lote ({formatKg(pesoSugerido)})
                    </Link>
                  ) : null}
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ display: 'grid', gap: 2 }}>
              <Typography variant="h6">Salida (procesado)</Typography>
              <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <Controller
                    control={control}
                    name="producto_destino_id"
                    render={({ field }) => (
                      <TextField
                        select
                        label="Producto procesado *"
                        fullWidth
                        size="small"
                        disabled={!origen}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={!!errors.producto_destino_id || (!!origen && destinos.length === 0)}
                        helperText={
                          errors.producto_destino_id?.message ??
                          (!origen
                            ? 'Primero elige el crudo'
                            : destinos.length === 0
                              ? `${origen.producto.nombre} no tiene procesados asignados (Catálogos)`
                              : undefined)
                        }
                      >
                        {destinos.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            {etiqueta(p)}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <Controller
                    control={control}
                    name="peso_salida_kg"
                    render={({ field }) => (
                      <NumberField
                        label="Peso de salida *"
                        fullWidth
                        size="small"
                        decimals={3}
                        suffix="kg"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={!!errors.peso_salida_kg || salidaExcede}
                        helperText={
                          errors.peso_salida_kg?.message ??
                          (salidaExcede ? 'No puede superar el peso de entrada' : undefined)
                        }
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>

            <TextField
              label="Notas"
              fullWidth
              size="small"
              multiline
              maxRows={3}
              {...register('notas')}
              placeholder="Ej. fileteado, descamado"
            />

            <Box
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                pt: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, auto)' },
                justifyContent: { sm: 'end' },
                columnGap: 4,
                rowGap: 1,
              }}
            >
              <Resumen
                label="Merma"
                value={calculo && !salidaExcede ? formatKg(calculo.merma_kg) : '—'}
              />
              <Resumen
                label="Merma %"
                value={calculo && !salidaExcede ? pctFormatter.format(1 - calculo.rendimiento) : '—'}
              />
              <Resumen
                label="Rendimiento"
                value={calculo && !salidaExcede ? pctFormatter.format(calculo.rendimiento) : '—'}
                destacado
              />
              {costoLote != null ? (
                <Resumen
                  label="Costo/kg procesado"
                  value={
                    calculo && !salidaExcede ? formatUsd(calculo.costo_kg_destino) : '—'
                  }
                  destacado
                />
              ) : null}
            </Box>

            {costoLote != null && lote && calculo && !salidaExcede ? (
              <Typography variant="caption" color="text.secondary">
                El costo del lote {lote.codigo} ({formatUsd(calculo.costo_total_usd)} a{' '}
                {formatUsd(costoLote)}/kg) pasa completo al lote procesado.
              </Typography>
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
            disabled={isPending || sinProductos}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Registrar procesamiento
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
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
