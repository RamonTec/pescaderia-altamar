'use client'

import * as React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Radio from '@mui/material/Radio'
import FormControlLabel from '@mui/material/FormControlLabel'
import Autocomplete from '@mui/material/Autocomplete'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Fade from '@mui/material/Fade'
import MenuItem from '@mui/material/MenuItem'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { BANCOS_VE, bancoDesdeCuenta } from '@/lib/bancosVe'
import type { MetodoPagoFormValues } from '@/lib/proveedorValidation'
import { useConfirm } from '@/lib/useConfirm'

export interface MetodoPagoCardProps {
  index: number
  metodo: MetodoPagoFormValues
  onRemove: () => void
}

const BANCO_OPCIONES = Object.entries(BANCOS_VE).map(([codigo, nombre]) => ({
  codigo,
  nombre,
}))

export function MetodoPagoCard({ index, metodo, onRemove }: MetodoPagoCardProps) {
  const confirm = useConfirm()
  const { register, control, setValue, watch, formState } = useFormContext()

  const campo = (name: string) => `metodosPago.${index}.${name}`
  const errorDe = (name: string): string | undefined =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (formState.errors as any)?.metodosPago?.[index]?.[name]?.message

  const numeroCuenta = watch(campo('numero_cuenta')) as string
  const bancoDetectado =
    metodo.tipo === 'transferencia' && numeroCuenta
      ? bancoDesdeCuenta(numeroCuenta)
      : null

  React.useEffect(() => {
    if (
      metodo.tipo === 'transferencia' &&
      bancoDetectado &&
      metodo.banco_codigo !== numeroCuenta?.slice(0, 4)
    ) {
      setValue(`metodosPago.${index}.banco_codigo`, numeroCuenta.slice(0, 4))
    }
  }, [bancoDetectado, numeroCuenta, metodo.tipo, metodo.banco_codigo, index, setValue])

  const handleRemove = async () => {
    const tieneDatos =
      metodo.tipo === 'transferencia'
        ? !!(metodo.numero_cuenta || metodo.titular)
        : metodo.tipo === 'pago_movil'
          ? !!(metodo.telefono || metodo.titular_rif_ci)
          : !!(metodo.email || metodo.telefono || metodo.titular)

    if (tieneDatos) {
      const ok = await confirm({
        title: 'Quitar método de pago',
        message: 'Este método tiene datos ingresados. ¿Quitar de todos modos?',
        confirmLabel: 'Quitar',
        destructive: true,
      })
      if (!ok) return
    }
    onRemove()
  }

  const titulo =
    metodo.tipo === 'pago_movil'
      ? 'Pago Móvil'
      : metodo.tipo === 'transferencia'
        ? 'Transferencia'
        : 'Zelle'

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        display: 'grid',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1">{titulo}</Typography>
          <Controller
            control={control}
            name={campo('preferido')}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Radio
                    size="small"
                    checked={field.value as boolean}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label="Preferido"
              />
            )}
          />
        </Box>
        <IconButton aria-label="Quitar método" color="error" size="small" onClick={handleRemove}>
          <DeleteOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>

      {metodo.tipo === 'transferencia' ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Número de cuenta *"
              fullWidth
              size="small"
              error={!!errorDe('numero_cuenta')}
              helperText={errorDe('numero_cuenta')}
              slotProps={{ htmlInput: { maxLength: 20, inputMode: 'numeric' } }}
              {...register(campo('numero_cuenta'))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Fade in={!!bancoDetectado} timeout={200}>
              <Box>
                {bancoDetectado ? (
                  <Chip label={bancoDetectado} color="secondary" size="small" />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    El banco se detecta con los primeros 4 dígitos.
                  </Typography>
                )}
              </Box>
            </Fade>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Tipo de cuenta"
              fullWidth
              size="small"
              value={metodo.tipo_cuenta ?? ''}
              onChange={(e) =>
                setValue(campo('tipo_cuenta'), e.target.value || null)
              }
            >
              <MenuItem value="">—</MenuItem>
              <MenuItem value="corriente">Corriente</MenuItem>
              <MenuItem value="ahorro">Ahorro</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Titular *"
              fullWidth
              size="small"
              error={!!errorDe('titular')}
              helperText={errorDe('titular')}
              {...register(campo('titular'))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="RIF/CI del titular *"
              fullWidth
              size="small"
              error={!!errorDe('titular_rif_ci')}
              helperText={errorDe('titular_rif_ci')}
              {...register(campo('titular_rif_ci'))}
            />
          </Grid>
        </Grid>
      ) : metodo.tipo === 'pago_movil' ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name={campo('banco_codigo')}
              render={({ field }) => (
                <Autocomplete
                  size="small"
                  options={BANCO_OPCIONES}
                  getOptionLabel={(o) => `${o.codigo} — ${o.nombre}`}
                  value={BANCO_OPCIONES.find((o) => o.codigo === field.value) ?? null}
                  onChange={(_, next) => field.onChange(next?.codigo ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Banco *"
                      error={!!errorDe('banco_codigo')}
                      helperText={errorDe('banco_codigo')}
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Teléfono móvil *"
              fullWidth
              size="small"
              error={!!errorDe('telefono')}
              helperText={errorDe('telefono')}
              {...register(campo('telefono'))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="RIF/CI del titular *"
              fullWidth
              size="small"
              error={!!errorDe('titular_rif_ci')}
              helperText={errorDe('titular_rif_ci')}
              {...register(campo('titular_rif_ci'))}
            />
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Titular *"
              fullWidth
              size="small"
              error={!!errorDe('titular')}
              helperText={errorDe('titular')}
              {...register(campo('titular'))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              size="small"
              error={!!errorDe('email')}
              helperText={errorDe('email')}
              {...register(campo('email'))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Teléfono"
              fullWidth
              size="small"
              error={!!errorDe('telefono')}
              helperText={errorDe('telefono')}
              {...register(campo('telefono'))}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  )
}
