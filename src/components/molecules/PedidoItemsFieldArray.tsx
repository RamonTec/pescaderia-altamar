'use client'

import * as React from 'react'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { NumberField } from '@/components/atoms/NumberField'
import { formatUsd } from '@/lib/format'
import type { PedidoFormInput } from '@/lib/pedidoValidation'
import type { Producto } from '@/types/domain'
import { useConfirm } from '@/lib/useConfirm'

const NUM = { fontVariantNumeric: 'tabular-nums' }

export interface PedidoItemsFieldArrayProps {
  productos: Producto[]
  /** "Peso estimado" (pedido) vs "Peso real" (venta directa). */
  etiquetaPeso: string
  /**
   * Contenido extra bajo cada línea (07-lotes: los lotes de la venta directa,
   * `LotesLineaVenta`). Recibe el índice y el id estable de la fila.
   */
  renderLinea?: (index: number, filaId: string) => React.ReactNode
  /** Se llama al quitar una línea (id estable de la fila). */
  onQuitar?: (filaId: string) => void
}

export const pedidoItemVacio = (): PedidoFormInput['items'][number] => ({
  producto_id: '',
  peso_kg: null,
  precio_usd_kg: null,
  asignaciones: undefined,
})

/**
 * Items de un pedido/venta: producto, peso (estimado o real) y precio/kg en USD.
 * Muestra el importe de cada línea. Cambiar el producto o el peso descarta
 * los lotes elegidos a mano (la línea vuelve a PEPS, 07-lotes).
 */
export function PedidoItemsFieldArray({
  productos,
  etiquetaPeso,
  renderLinea,
  onQuitar,
}: PedidoItemsFieldArrayProps) {
  const confirm = useConfirm()
  const {
    control,
    setValue,
    formState: { errors, disabled },
  } = useFormContext<PedidoFormInput>()
  const volverAPeps = (index: number) =>
    setValue(`items.${index}.asignaciones`, undefined, { shouldDirty: true })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' })

  const quitar = async (index: number) => {
    const item = items?.[index]
    const tieneDatos = !!item?.producto_id || item?.peso_kg != null || item?.precio_usd_kg != null
    if (tieneDatos) {
      const ok = await confirm({
        title: '¿Quitar este producto?',
        message: 'Se perderán el peso y el precio ingresados en esta línea.',
        confirmLabel: 'Quitar',
        destructive: true,
      })
      if (!ok) return
    }
    onQuitar?.(fields[index].id)
    remove(index)
  }

  const errorLista = errors.items?.message ?? errors.items?.root?.message

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Productos</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => append(pedidoItemVacio())} disabled={disabled}>
          Agregar
        </Button>
      </Box>

      {productos.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay productos activos. Créalos en Catálogos antes de registrar una venta.
        </Typography>
      ) : null}

      {fields.map((field, index) => {
        const item = items?.[index]
        const importe =
          item?.peso_kg != null && item?.precio_usd_kg != null
            ? item.peso_kg * item.precio_usd_kg
            : null
        const errorItem = errors.items?.[index]

        return (
          <Box
            key={field.id}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}
          >
            <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Controller
                  control={control}
                  name={`items.${index}.producto_id`}
                  render={({ field: f }) => (
                    <TextField
                      select
                      label="Producto *"
                      fullWidth
                      size="small"
                      value={f.value}
                      onChange={(e) => {
                        f.onChange(e)
                        volverAPeps(index)
                      }}
                      onBlur={f.onBlur}
                      error={!!errorItem?.producto_id}
                      helperText={errorItem?.producto_id?.message}
                      disabled={disabled}
                    >
                      {productos.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Controller
                  control={control}
                  name={`items.${index}.peso_kg`}
                  render={({ field: f }) => (
                    <NumberField
                      label={`${etiquetaPeso} *`}
                      fullWidth
                      size="small"
                      decimals={3}
                      suffix="kg"
                      value={f.value}
                      onChange={(v) => {
                        f.onChange(v)
                        volverAPeps(index)
                      }}
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
                      label="Precio/kg (USD) *"
                      fullWidth
                      size="small"
                      decimals={2}
                      prefix="$"
                      value={f.value}
                      onChange={f.onChange}
                      onBlur={f.onBlur}
                      error={!!errorItem?.precio_usd_kg}
                      helperText={errorItem?.precio_usd_kg?.message}
                      disabled={disabled}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 1 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <IconButton
                  aria-label="Quitar producto"
                  onClick={() => quitar(index)}
                  disabled={fields.length === 1 || disabled}
                >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
            {renderLinea?.(index, field.id)}
            {importe != null ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, textAlign: 'right', ...NUM }}
              >
                {formatUsd(importe)}
              </Typography>
            ) : null}
          </Box>
        )
      })}

      {errorLista ? (
        <Typography variant="caption" color="error">
          {errorLista}
        </Typography>
      ) : null}
    </Box>
  )
}
