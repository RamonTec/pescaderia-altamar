'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { NumberField } from '@/components/atoms/NumberField'
import { CompraItemsFieldArray, itemVacio } from '@/components/molecules/CompraItemsFieldArray'
import {
  compraFormSchema,
  type CompraFormInput,
  type CompraFormValues,
} from '@/lib/compraValidation'
import { fechaHoy, formatBs, formatTasa, formatUsd } from '@/lib/format'
import type { TasaSugerida } from '@/lib/services/compraService'
import type { Producto, Proveedor } from '@/types/domain'
import { crearCompraAction } from '@/app/(protected)/compras/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

const MONO = { fontFamily: 'var(--font-geist-mono)', fontVariantNumeric: 'tabular-nums' }

const FUENTE_LABEL = { bcv: 'BCV', paralela: 'paralela', manual: 'manual' } as const

export interface CompraFormProps {
  open: boolean
  onClose: () => void
  /** Proveedores activos (03-proveedores). */
  proveedores: Proveedor[]
  /** Productos crudos activos. */
  productos: Producto[]
  tasaSugerida: TasaSugerida | null
}

function vacio(tasa: TasaSugerida | null): CompraFormInput {
  return {
    proveedor_id: '',
    fecha: fechaHoy(),
    condicion: 'contado',
    moneda: 'usd',
    tasa: tasa?.bs_por_usd ?? null,
    notas: '',
    items: [itemVacio()],
  }
}

/**
 * Registro de una compra (recepción): proveedor, condición, moneda, tasa del
 * día congelada e items pesados. El total se recalcula en vivo en USD y Bs.
 * Montar con un `key` que cambie al abrir: así cada apertura empieza en blanco.
 */
export function CompraForm({ open, onClose, proveedores, productos, tasaSugerida }: CompraFormProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<CompraFormInput, unknown, CompraFormValues>({
    resolver: zodResolver(compraFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(tasaSugerida),
  })
  const { control, register, handleSubmit, setError, setValue, formState } = methods

  const [proveedorId, condicion, moneda, tasa, items] = useWatch({
    control,
    name: ['proveedor_id', 'condicion', 'moneda', 'tasa', 'items'],
  })
  const proveedor = proveedores.find((p) => p.id === proveedorId) ?? null

  const totalMoneda = (items ?? []).reduce(
    (s, i) => s + (i.peso_kg != null && i.costo_kg != null ? i.peso_kg * i.costo_kg : 0),
    0
  )
  const totalKg = (items ?? []).reduce((s, i) => s + (i.peso_kg ?? 0), 0)
  const tasaValida = tasa != null && tasa > 0
  const totalUsd = moneda === 'usd' ? totalMoneda : tasaValida ? totalMoneda / tasa : null
  const totalBs = moneda === 'bs' ? totalMoneda : tasaValida ? totalMoneda * tasa : null

  const pedirCierre = async () => {
    if (formState.isDirty) {
      const ok = await confirm({
        title: '¿Descartar la compra?',
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
      const result = await crearCompraAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          // @ts-expect-error setError con path dinámico
          setError(campo, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Compra registrada')
      onClose()
    })
  })

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : pedirCierre}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
    >
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <DialogTitle>Nueva compra</DialogTitle>

          <DialogContent dividers>
            <Box sx={{ display: 'grid', gap: 3 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <Controller
                    control={control}
                    name="proveedor_id"
                    render={({ field }) => (
                      <Autocomplete
                        options={proveedores}
                        value={proveedor}
                        onChange={(_, next) => {
                          field.onChange(next?.id ?? '')
                          // Con proveedor bloqueado solo se admite contado.
                          if (next?.bloqueado) setValue('condicion', 'contado')
                        }}
                        onBlur={field.onBlur}
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
                            {p.bloqueado ? <Chip label="Bloqueado" size="small" color="error" /> : null}
                          </Box>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Proveedor *"
                            error={!!formState.errors.proveedor_id}
                            helperText={formState.errors.proveedor_id?.message}
                          />
                        )}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Fecha *"
                    type="date"
                    fullWidth
                    {...register('fecha')}
                    error={!!formState.errors.fecha}
                    helperText={formState.errors.fecha?.message}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>

              {proveedor?.bloqueado ? (
                <Alert severity="warning">
                  {proveedor.nombre} está bloqueado
                  {proveedor.motivo_bloqueo ? ` (${proveedor.motivo_bloqueo})` : ''}: solo se le puede
                  comprar de contado.
                </Alert>
              ) : null}

              <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
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
                        value={field.value}
                        onChange={(_, next) => next && field.onChange(next)}
                        aria-label="Condición de pago"
                      >
                        <ToggleButton value="contado">Contado</ToggleButton>
                        <ToggleButton value="credito" disabled={!!proveedor?.bloqueado}>
                          Crédito
                        </ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  />
                  {formState.errors.condicion ? (
                    <Typography variant="caption" color="error" component="p">
                      {formState.errors.condicion.message}
                    </Typography>
                  ) : null}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
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
                        onChange={(_, next) => next && field.onChange(next)}
                        aria-label="Moneda de la compra"
                      >
                        <ToggleButton value="usd">USD</ToggleButton>
                        <ToggleButton value="bs">Bs</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="tasa"
                    render={({ field }) => (
                      <NumberField
                        label="Tasa del día (Bs/USD) *"
                        fullWidth
                        decimals={4}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={!!formState.errors.tasa}
                        helperText={
                          formState.errors.tasa?.message ??
                          (tasaSugerida
                            ? `Sugerida (${FUENTE_LABEL[tasaSugerida.fuente]}): ${formatTasa(tasaSugerida.bs_por_usd)}`
                            : 'No hay tasa registrada hoy: ingrésala a mano')
                        }
                      />
                    )}
                  />
                  {tasaSugerida && tasa !== tasaSugerida.bs_por_usd ? (
                    <Link
                      component="button"
                      type="button"
                      variant="caption"
                      onClick={() =>
                        setValue('tasa', tasaSugerida.bs_por_usd, { shouldDirty: true })
                      }
                    >
                      Usar la sugerida
                    </Link>
                  ) : null}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Notas"
                    fullWidth
                    multiline
                    maxRows={3}
                    {...register('notas')}
                    placeholder="Ej. N.º de guía, lote"
                  />
                </Grid>
              </Grid>

              <CompraItemsFieldArray productos={productos} />

              <Box
                sx={{
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  pt: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, auto)' },
                  justifyContent: { sm: 'end' },
                  columnGap: 4,
                  rowGap: 1,
                }}
              >
                <Resumen label="Peso total" value={`${totalKg.toFixed(3)} kg`} />
                <Resumen label="Total USD" value={totalUsd != null ? formatUsd(totalUsd) : '—'} destacado />
                <Resumen label="Equivalente Bs" value={totalBs != null ? formatBs(totalBs) : '—'} />
              </Box>

              {condicion === 'credito' && totalUsd ? (
                <Alert severity="info">
                  Quedará una cuenta por pagar de {formatUsd(totalUsd)} a {proveedor?.nombre ?? 'este proveedor'}.
                </Alert>
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
              disabled={isPending || productos.length === 0}
              startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Registrar compra
            </Button>
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  )
}

function Resumen({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <Box sx={{ textAlign: { sm: 'right' } }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant={destacado ? 'h6' : 'body2'} sx={MONO}>
        {value}
      </Typography>
    </Box>
  )
}
