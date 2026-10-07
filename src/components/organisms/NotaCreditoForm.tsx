'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { NumberField } from '@/components/atoms/NumberField'
import { notaCreditoFormSchema, type NotaCreditoFormInput, type NotaCreditoFormValues } from '@/lib/notaCreditoValidation'
import { fechaHoy, formatKg, formatUsd } from '@/lib/format'
import type { FacturaDetalle, FacturaResumen } from '@/lib/repositories/interfaces'
import { facturaRepository } from '@/lib/repositories/facturaRepository'
import { notaCreditoRepository } from '@/lib/repositories/notaCreditoRepository'
import { emitirNotaCreditoAction } from '@/app/(protected)/notas-credito/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

const NUM = { fontVariantNumeric: 'tabular-nums' }

export interface NotaCreditoFormProps {
  open: boolean
  onClose: () => void
  facturas: FacturaResumen[]
  /** Factura preseleccionada (al abrir desde una ficha). */
  facturaInicialId?: string | null
}

function vacio(facturaId: string): NotaCreditoFormInput {
  return { factura_id: facturaId, fecha: fechaHoy(), motivo: '', items: [] }
}

/**
 * Emisión de una nota de crédito sobre una factura existente. Por item se captura
 * el peso a devolver (≤ facturado − ya devuelto) y si vuelve a stock.
 */
export function NotaCreditoForm({ open, onClose, facturas, facturaInicialId }: NotaCreditoFormProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const { control, register, handleSubmit, setValue, setError, reset, formState } = useForm<
    NotaCreditoFormInput,
    unknown,
    NotaCreditoFormValues
  >({
    resolver: zodResolver(notaCreditoFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(facturaInicialId ?? ''),
  })

  const facturaId = useWatch({ control, name: 'factura_id' })
  const items = useWatch({ control, name: 'items' })

  const [cargado, setCargado] = React.useState<{
    id: string
    detalle: FacturaDetalle | null
    disponible: Map<string, number>
  } | null>(null)

  const facturaSeleccionada = facturas.find((f) => f.id === facturaId) ?? null
  const detalle = cargado?.id === facturaId ? cargado.detalle : null
  const disponiblePorItem = cargado?.id === facturaId ? cargado.disponible : new Map()
  const cargando = !!facturaId && cargado?.id !== facturaId

  React.useEffect(() => {
    if (!open) return
    if (facturaInicialId) {
      reset(vacio(facturaInicialId))
    }
  }, [open, facturaInicialId, reset])

  React.useEffect(() => {
    if (!facturaId) return
    let active = true
    Promise.all([facturaRepository.getById(facturaId), notaCreditoRepository.listByFactura(facturaId)])
      .then(async ([det, notas]) => {
        const devuelto = new Map<string, number>()
        for (const n of notas) {
          if (n.estado !== 'emitida') continue
          const d = await notaCreditoRepository.getById(n.id)
          for (const i of d?.items ?? []) {
            devuelto.set(i.factura_item_id, (devuelto.get(i.factura_item_id) ?? 0) + Number(i.peso_kg))
          }
        }
        const disponible = new Map<string, number>()
        for (const i of det?.items ?? []) {
          disponible.set(i.id, Number(i.peso_kg) - (devuelto.get(i.id) ?? 0))
        }
        if (!active) return
        setCargado({ id: facturaId, detalle: det, disponible })
      })
      .catch((e) => {
        if (active) {
          setCargado({ id: facturaId, detalle: null, disponible: new Map() })
          notify.error(e instanceof Error ? e.message : 'No se pudo cargar la factura')
        }
      })
    return () => {
      active = false
    }
  }, [facturaId, notify])

  const totalDevolucion = (items ?? []).reduce((s, i) => {
    const original = detalle?.items.find((fi) => fi.id === i.factura_item_id)
    return s + (i.peso_kg != null && original ? i.peso_kg * Number(original.precio_usd_kg) : 0)
  }, 0)

  const pedirCierre = async () => {
    if (formState.isDirty) {
      const ok = await confirm({
        title: '¿Descartar?',
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
      const result = await emitirNotaCreditoAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          // @ts-expect-error setError con path dinámico
          setError(campo, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Nota de crédito emitida')
      onClose()
    })
  })

  const cambiarItem = (facturaItemId: string, peso: number | null, afecta: boolean) => {
    const actual = items ?? []
    const idx = actual.findIndex((i) => i.factura_item_id === facturaItemId)
    const item = { factura_item_id: facturaItemId, peso_kg: peso, afecta_inventario: afecta }
    const next = [...actual]
    if (idx >= 0) next[idx] = item
    else next.push(item)
    setValue('items', next, { shouldDirty: true })
  }

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : pedirCierre}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <Box component="form" onSubmit={onSubmit} noValidate>
        <DialogTitle>Emitir nota de crédito</DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            <Controller
              control={control}
              name="factura_id"
              render={({ field }) => (
                <Autocomplete
                  options={facturas}
                  value={facturaSeleccionada}
                  onChange={(_, next) => {
                    field.onChange(next?.id ?? '')
                    setValue('items', [], { shouldDirty: true })
                  }}
                  onBlur={field.onBlur}
                  getOptionLabel={(f) => `N.º ${f.numero} · ${f.cliente?.nombre ?? ''}`}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  noOptionsText="Sin facturas"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Factura *"
                      error={!!formState.errors.factura_id}
                      helperText={formState.errors.factura_id?.message}
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
              error={!!formState.errors.fecha}
              helperText={formState.errors.fecha?.message}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              label="Motivo *"
              fullWidth
              size="small"
              multiline
              maxRows={3}
              {...register('motivo')}
              placeholder="Ej. producto en mal estado, error de pesaje, devolución parcial"
              error={!!formState.errors.motivo}
              helperText={formState.errors.motivo?.message}
            />

            {cargando ? (
              <Typography variant="body2" color="text.secondary">
                Cargando items…
              </Typography>
            ) : detalle && detalle.items.length > 0 ? (
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Typography variant="h6">Items a devolver</Typography>
                {detalle.items.map((fi) => {
                  const disponible = disponiblePorItem.get(fi.id) ?? 0
                  const actual = (items ?? []).find((i) => i.factura_item_id === fi.id)
                  const tiene = disponible > 0
                  return (
                    <Box key={fi.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                      <Typography variant="body2">
                        {fi.producto.nombre}{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                          · facturado {formatKg(Number(fi.peso_kg))} · disponible {formatKg(disponible)}
                        </Typography>
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mt: 1, flexWrap: 'wrap' }}>
                        <Box sx={{ width: 160 }}>
                          <NumberField
                            label="Peso a devolver"
                            fullWidth
                            size="small"
                            decimals={3}
                            suffix="kg"
                            disabled={!tiene}
                            value={actual?.peso_kg ?? null}
                            onChange={(v) => cambiarItem(fi.id, v, actual?.afecta_inventario ?? false)}
                          />
                        </Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={actual?.afecta_inventario ?? false}
                              disabled={!tiene}
                              onChange={(_, checked) =>
                                cambiarItem(fi.id, actual?.peso_kg ?? null, checked)
                              }
                            />
                          }
                          label="Vuelve a stock"
                        />
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            ) : detalle ? (
              <Typography variant="body2" color="text.secondary">
                No hay items disponibles para devolver en esta factura.
              </Typography>
            ) : null}

            {totalDevolucion > 0 ? (
              <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">
                  Subtotal a devolver
                </Typography>
                <Typography variant="h6" sx={NUM}>
                  {formatUsd(totalDevolucion)}
                </Typography>
              </Box>
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
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Emitir nota
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
