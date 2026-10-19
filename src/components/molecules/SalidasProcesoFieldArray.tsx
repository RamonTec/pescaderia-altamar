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
import { formatPct, formatUsd } from '@/lib/format'
import {
  MAX_SALIDAS,
  precioEfectivo,
  type ProcesamientoFormInput,
} from '@/lib/procesamientoValidation'
import type { RepartoSalida } from '@/lib/services/costingService'
import type { Producto } from '@/types/domain'
import { useConfirm } from '@/lib/useConfirm'

const NUM = { fontVariantNumeric: 'tabular-nums' }

export const salidaVacia = (
  productoId = ''
): ProcesamientoFormInput['salidas'][number] => ({
  producto_destino_id: productoId,
  peso_salida_kg: null,
  precio_referencia_usd_kg: null,
})

const etiqueta = (p: Producto) => (p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre)

export interface SalidasProcesoFieldArrayProps {
  /** Procesados activos del crudo elegido (vacío si no hay crudo). */
  destinos: Producto[]
  /** Peso de entrada válido (> 0) o `null`: base del `%` de cada salida. */
  entradaKg: number | null
  /**
   * Reparto calculado por fila (`repartirCostoProceso`). Solo se pasa a un
   * admin: sin él no se muestra ninguna cifra de costo.
   */
  costos?: RepartoSalida[] | null
  /** Primero hay que elegir el crudo. */
  sinOrigen: boolean
}

/**
 * Salidas de un procesamiento (16): 1 a 10 filas, cada una un procesado
 * distinto del crudo, con sus kg y su `%` de la entrada. Con ≥ 2 salidas
 * cada fila muestra su precio de referencia: de solo lectura si viene del
 * catálogo, o un campo obligatorio que se guarda en el catálogo. El costo
 * por fila (asignado, `%` y costo/kg) solo aparece si llega `costos` (admin).
 */
export function SalidasProcesoFieldArray({
  destinos,
  entradaKg,
  costos,
  sinOrigen,
}: SalidasProcesoFieldArrayProps) {
  const confirm = useConfirm()
  const {
    control,
    formState: { errors, disabled },
  } = useFormContext<ProcesamientoFormInput>()
  const { fields, append, remove } = useFieldArray({ control, name: 'salidas' })
  const salidas = useWatch({ control, name: 'salidas' })
  const conPrecio = fields.length >= 2

  const elegidos = new Set((salidas ?? []).map((s) => s.producto_destino_id).filter(Boolean))
  const maximo = Math.min(MAX_SALIDAS, destinos.length)
  const puedeAgregar = !sinOrigen && fields.length < maximo

  const quitar = async (index: number) => {
    const s = salidas?.[index]
    const tieneDatos =
      !!s?.producto_destino_id || s?.peso_salida_kg != null || s?.precio_referencia_usd_kg != null
    if (tieneDatos) {
      const ok = await confirm({
        title: '¿Quitar esta salida?',
        message: 'Se perderán el producto y los kg ingresados en esta fila.',
        confirmLabel: 'Quitar',
        destructive: true,
      })
      if (!ok) return
    }
    remove(index)
  }

  const errorLista = errors.salidas?.message ?? errors.salidas?.root?.message

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h6">Salidas (procesados)</Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={disabled || !puedeAgregar}
          onClick={() => append(salidaVacia())}
        >
          Agregar salida
        </Button>
      </Box>

      <Box>
        <TransitionGroup>
          {fields.map((field, index) => {
            const s = salidas?.[index]
            const errorFila = errors.salidas?.[index]
            const opciones = destinos.filter(
              (d) => d.id === s?.producto_destino_id || !elegidos.has(d.id)
            )
            const { precio, delCatalogo } = s?.producto_destino_id
              ? precioEfectivo(
                  {
                    producto_destino_id: s.producto_destino_id,
                    precio_referencia_usd_kg: s.precio_referencia_usd_kg ?? null,
                  },
                  destinos
                )
              : { precio: null, delCatalogo: false }
            const kg = s?.peso_salida_kg ?? null
            const pctEntrada = kg != null && kg > 0 && entradaKg ? kg / entradaKg : null
            const costo = costos?.[index] ?? null

            return (
              <Collapse key={field.id}>
                <Box sx={{ pb: 2 }}>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                    <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
                      <Grid size={{ xs: 12, sm: conPrecio ? 5 : 7 }}>
                        <Controller
                          control={control}
                          name={`salidas.${index}.producto_destino_id`}
                          render={({ field: f }) => (
                            <TextField
                              select
                              label="Producto procesado *"
                              fullWidth
                              size="small"
                              value={f.value}
                              onChange={f.onChange}
                              onBlur={f.onBlur}
                              disabled={disabled || sinOrigen}
                              error={!!errorFila?.producto_destino_id}
                              helperText={
                                errorFila?.producto_destino_id?.message ??
                                (sinOrigen ? 'Primero elige el crudo' : undefined)
                              }
                            >
                              {opciones.length === 0 ? (
                                <MenuItem value="" disabled>
                                  No hay más procesados de este crudo
                                </MenuItem>
                              ) : null}
                              {opciones.map((p) => (
                                <MenuItem key={p.id} value={p.id}>
                                  {etiqueta(p)}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}
                        />
                      </Grid>
                      <Grid size={{ xs: conPrecio ? 6 : 10, sm: conPrecio ? 3 : 4 }}>
                        <Controller
                          control={control}
                          name={`salidas.${index}.peso_salida_kg`}
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
                              error={!!errorFila?.peso_salida_kg}
                              helperText={
                                errorFila?.peso_salida_kg?.message ??
                                (pctEntrada != null
                                  ? `${formatPct(pctEntrada)} de la entrada`
                                  : undefined)
                              }
                            />
                          )}
                        />
                      </Grid>
                      {conPrecio ? (
                        <Grid size={{ xs: 6, sm: 3 }}>
                          {delCatalogo && precio != null ? (
                            <TextField
                              label="Precio ref."
                              fullWidth
                              size="small"
                              value={`${formatUsd(precio)}/kg`}
                              helperText="Del catálogo"
                              slotProps={{ input: { readOnly: true }, htmlInput: { tabIndex: -1 } }}
                            />
                          ) : (
                            <Controller
                              control={control}
                              name={`salidas.${index}.precio_referencia_usd_kg`}
                              render={({ field: f }) => (
                                <NumberField
                                  label="Precio ref. *"
                                  fullWidth
                                  size="small"
                                  decimals={2}
                                  prefix="$"
                                  suffix="/kg"
                                  value={f.value}
                                  onChange={f.onChange}
                                  onBlur={f.onBlur}
                                  disabled={disabled || !s?.producto_destino_id}
                                  error={!!errorFila?.precio_referencia_usd_kg}
                                  helperText={
                                    errorFila?.precio_referencia_usd_kg?.message ??
                                    'Se guardará en el catálogo'
                                  }
                                />
                              )}
                            />
                          )}
                        </Grid>
                      ) : null}
                      <Grid
                        size={{ xs: 2, sm: 1 }}
                        sx={{ display: 'flex', justifyContent: 'flex-end' }}
                      >
                        <IconButton
                          aria-label="Quitar salida"
                          onClick={() => quitar(index)}
                          disabled={disabled || fields.length === 1}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>

                    {costo ? (
                      <Box
                        sx={{
                          mt: 1.5,
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                          columnGap: 3,
                          rowGap: 0.5,
                        }}
                      >
                        <Dato label="Costo asignado" value={formatUsd(costo.costo_usd)} />
                        <Dato label="% del costo" value={formatPct(costo.participacion_costo)} />
                        <Dato label="Costo/kg" value={`${formatUsd(costo.costo_usd_kg)}/kg`} destacado />
                      </Box>
                    ) : null}
                  </Box>
                </Box>
              </Collapse>
            )
          })}
        </TransitionGroup>
      </Box>

      {errorLista ? (
        <Typography variant="caption" color="error" role="alert">
          {errorLista}
        </Typography>
      ) : null}
      {!sinOrigen && destinos.length > 0 && fields.length >= maximo && maximo < MAX_SALIDAS ? (
        <Typography variant="caption" color="text.secondary">
          Ya usaste todos los procesados de este crudo ({destinos.length}).
        </Typography>
      ) : null}
    </Box>
  )
}

function Dato({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <Box sx={{ textAlign: 'right' }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ ...NUM, fontWeight: destacado ? 600 : 400 }}>
        {value}
      </Typography>
    </Box>
  )
}
