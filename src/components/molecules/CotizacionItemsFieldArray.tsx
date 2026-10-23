'use client'

import * as React from 'react'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined'
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined'
import { NumberField } from '@/components/atoms/NumberField'
import { formatUsd } from '@/lib/format'
import { subtotalLinea } from '@/lib/cotizaciones/totales'
import { MAX_LINEAS_COTIZACION, type CotizacionFormInput } from '@/lib/cotizacionValidation'
import { useConfirm } from '@/lib/useConfirm'
import type { Producto } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

export const cotizacionItemVacio = (): CotizacionFormInput['items'][number] => ({
  producto_id: '',
  peso_kg: null,
  precio_usd_kg: null,
  nota: '',
})

export interface CotizacionItemsFieldArrayProps {
  /** Productos activos (y los de la cotización aunque ya no lo estén, para mostrarlos). */
  productos: Producto[]
}

/**
 * Líneas de una cotización (21-cotizaciones): producto del catálogo
 * (Autocomplete), kg (3 decimales), precio USD/kg (hasta 6) precargado con
 * `precio_referencia_usd_kg` (P9; vacío en los crudos, siempre editable),
 * nota y subtotal en vivo. Quitar (confirma si hay datos) y reordenar. Cada
 * línea es una tarjeta que se apila en `xs`. Máximo 50 líneas.
 */
export function CotizacionItemsFieldArray({ productos }: CotizacionItemsFieldArrayProps) {
  const confirm = useConfirm()
  const {
    control,
    setValue,
    formState: { errors, disabled },
  } = useFormContext<CotizacionFormInput>()
  const { fields, append, remove, move } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' })
  const porId = React.useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const activos = React.useMemo(() => productos.filter((p) => p.activo), [productos])

  const quitar = async (index: number) => {
    const item = items?.[index]
    const tieneDatos = !!item?.producto_id || item?.peso_kg != null || item?.precio_usd_kg != null
    if (tieneDatos) {
      const ok = await confirm({
        title: '¿Quitar este producto?',
        message: 'Se perderán el peso, el precio y la nota de esta línea.',
        confirmLabel: 'Quitar',
        destructive: true,
      })
      if (!ok) return
    }
    remove(index)
  }

  const errorLista = errors.items?.message ?? errors.items?.root?.message
  const lleno = fields.length >= MAX_LINEAS_COTIZACION

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {activos.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay productos activos. Créalos en Catálogos antes de cotizar.
        </Typography>
      ) : null}

      {fields.map((field, index) => {
        const item = items?.[index]
        const errorItem = errors.items?.[index]
        const producto = item?.producto_id ? (porId.get(item.producto_id) ?? null) : null
        const subtotal =
          item?.peso_kg != null && item?.precio_usd_kg != null
            ? subtotalLinea({ peso_kg: item.peso_kg, precio_usd_kg: item.precio_usd_kg })
            : null

        return (
          <Box
            key={field.id}
            component="fieldset"
            aria-label={`Línea ${index + 1}`}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, m: 0, minWidth: 0 }}
          >
            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Controller
                  control={control}
                  name={`items.${index}.producto_id`}
                  render={({ field: f }) => (
                    <Autocomplete
                      options={activos}
                      value={producto}
                      disabled={disabled}
                      onChange={(_, next) => {
                        f.onChange(next?.id ?? '')
                        // P9: precio de referencia del procesado; vacío en los crudos.
                        setValue(`items.${index}.precio_usd_kg`, next?.precio_referencia_usd_kg ?? null, {
                          shouldDirty: true,
                        })
                      }}
                      onBlur={f.onBlur}
                      getOptionLabel={(p) => (p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre)}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      noOptionsText="Sin productos activos"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Producto *"
                          size="small"
                          error={!!errorItem?.producto_id}
                          helperText={
                            errorItem?.producto_id?.message ??
                            (producto && !producto.activo ? 'Producto inactivo: cámbialo para guardar' : undefined)
                          }
                        />
                      )}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Controller
                  control={control}
                  name={`items.${index}.peso_kg`}
                  render={({ field: f }) => (
                    <NumberField
                      label="Kg *"
                      fullWidth
                      size="small"
                      decimals={3}
                      suffix="kg"
                      value={f.value}
                      onChange={f.onChange}
                      onBlur={f.onBlur}
                      error={!!errorItem?.peso_kg}
                      helperText={errorItem?.peso_kg?.message}
                      disabled={disabled}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Controller
                  control={control}
                  name={`items.${index}.precio_usd_kg`}
                  render={({ field: f }) => (
                    <NumberField
                      label="Precio USD/kg *"
                      fullWidth
                      size="small"
                      decimals={6}
                      prefix="$"
                      value={f.value}
                      onChange={f.onChange}
                      onBlur={f.onBlur}
                      error={!!errorItem?.precio_usd_kg}
                      helperText={
                        errorItem?.precio_usd_kg?.message ?? (f.value === 0 ? 'Precio 0: muestra u obsequio' : undefined)
                      }
                      disabled={disabled}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 1 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <IconButton aria-label="Quitar producto" onClick={() => quitar(index)} disabled={disabled}>
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Controller
                  control={control}
                  name={`items.${index}.nota`}
                  render={({ field: f }) => (
                    <TextField
                      label="Nota"
                      placeholder="Ej. limpio, en filetes de 200 g"
                      fullWidth
                      size="small"
                      value={f.value}
                      onChange={f.onChange}
                      onBlur={f.onBlur}
                      error={!!errorItem?.nota}
                      helperText={errorItem?.nota?.message}
                      disabled={disabled}
                      slotProps={{ htmlInput: { maxLength: 200 } }}
                    />
                  )}
                />
              </Grid>
              <Grid
                size={{ xs: 12, sm: 4 }}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, minHeight: 40 }}
              >
                <Box sx={{ display: 'flex', gap: 0.5, mr: 'auto' }}>
                  <IconButton
                    aria-label="Subir línea"
                    size="small"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0 || disabled}
                  >
                    <ArrowUpwardOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Bajar línea"
                    size="small"
                    onClick={() => move(index, index + 1)}
                    disabled={index === fields.length - 1 || disabled}
                  >
                    <ArrowDownwardOutlinedIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={NUM}>
                  {subtotal != null ? formatUsd(subtotal) : '—'}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        )
      })}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        {errorLista ? (
          <Typography variant="caption" color="error">
            {errorLista}
          </Typography>
        ) : (
          <span />
        )}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => append(cotizacionItemVacio())}
          disabled={disabled || lleno || activos.length === 0}
        >
          Agregar producto
        </Button>
      </Box>
    </Box>
  )
}
