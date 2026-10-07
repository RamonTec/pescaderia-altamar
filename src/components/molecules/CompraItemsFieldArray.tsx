'use client'

import * as React from 'react'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { TransitionGroup } from 'react-transition-group'
import { NumberField } from '@/components/atoms/NumberField'
import { formatBs, formatUsd } from '@/lib/format'
import type { CompraFormInput } from '@/lib/compraValidation'
import type { Producto } from '@/types/domain'
import { useConfirm } from '@/lib/useConfirm'

const NUM = { fontVariantNumeric: 'tabular-nums' }

export interface CompraItemsFieldArrayProps {
  /** Solo productos crudos activos. */
  productos: Producto[]
}

export const itemVacio = (): CompraFormInput['items'][number] => ({
  producto_id: '',
  peso_kg: null,
  costo_kg: null,
})

/**
 * Items de una compra: producto crudo, peso pesado y costo por kg en la
 * moneda de la compra. Muestra el importe de cada línea en esa moneda.
 */
export function CompraItemsFieldArray({ productos }: CompraItemsFieldArrayProps) {
  const confirm = useConfirm()
  const {
    control,
    formState: { errors, disabled },
  } = useFormContext<CompraFormInput>()
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' })
  const moneda = useWatch({ control, name: 'moneda' })
  const formatMonto = moneda === 'bs' ? formatBs : formatUsd

  const quitar = async (index: number) => {
    const item = items?.[index]
    const tieneDatos = !!item?.producto_id || item?.peso_kg != null || item?.costo_kg != null
    if (tieneDatos) {
      const ok = await confirm({
        title: '¿Quitar este producto?',
        message: 'Se perderán el peso y el costo ingresados en esta línea.',
        confirmLabel: 'Quitar',
        destructive: true,
      })
      if (!ok) return
    }
    remove(index)
  }

  const errorLista = errors.items?.message ?? errors.items?.root?.message

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -4 }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={disabled}
          onClick={() => append(itemVacio())}
        >
          Agregar
        </Button>
      </Box>

      {productos.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay productos crudos activos. Créalos en Catálogos antes de registrar una compra.
        </Typography>
      ) : null}

      <Box>
        <TransitionGroup>
          {fields.map((field, index) => {
            const item = items?.[index]
            const importe =
              item?.peso_kg != null && item?.costo_kg != null ? item.peso_kg * item.costo_kg : null
            const errorItem = errors.items?.[index]

            return (
              <Collapse key={field.id}>
                <Box sx={{ pb: 2 }}>
                  <Box
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
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              disabled={disabled}
                              error={!!errorItem?.producto_id}
                              helperText={errorItem?.producto_id?.message}
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
                              label="Peso *"
                              fullWidth
                              size="small"
                              decimals={3}
                              suffix="kg"
                              value={f.value}
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              disabled={disabled}
                              error={!!errorItem?.peso_kg}
                              helperText={errorItem?.peso_kg?.message}
                            />
                          )}
                        />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Controller
                          control={control}
                          name={`items.${index}.costo_kg`}
                          render={({ field: f }) => (
                            <NumberField
                              label="Costo/kg *"
                              fullWidth
                              size="small"
                              decimals={2}
                              prefix={moneda === 'bs' ? 'Bs' : '$'}
                              value={f.value}
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              disabled={disabled}
                              error={!!errorItem?.costo_kg}
                              helperText={errorItem?.costo_kg?.message}
                            />
                          )}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 1 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <IconButton
                          aria-label="Quitar producto"
                          onClick={() => quitar(index)}
                          disabled={disabled || fields.length === 1}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                    {importe != null ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1, textAlign: 'right', ...NUM }}
                      >
                        {formatMonto(importe)}
                      </Typography>
                    ) : null}
                  </Box>
                </Box>
              </Collapse>
            )
          })}
        </TransitionGroup>
      </Box>

      {errorLista ? (
        <Typography variant="caption" color="error">
          {errorLista}
        </Typography>
      ) : null}
    </Box>
  )
}
