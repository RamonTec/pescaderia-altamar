'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

import { AppDialog } from '@/components/organisms/AppDialog'
import { NumberField } from '@/components/atoms/NumberField'
import { FormSection } from '@/components/molecules/FormSection'
import {
  gastoRecurrenteSchema,
  type GastoRecurrenteInput,
  type GastoRecurrenteValues,
} from '@/lib/gastoRecurrenteValidation'
import { METODOS_PAGO_GASTO } from '@/lib/gastoValidation'
import { proximasFechas } from '@/lib/gastos/periodos'
import { ETIQUETA_METODO } from '@/lib/dashboard/etiquetas'
import { fechaHoy, formatFecha } from '@/lib/format'
import { useNotify } from '@/lib/useNotify'
import { guardarRecurrenteAction } from '@/app/(protected)/gastos/actions'
import type { CategoriaGasto, Empleado, GastoRecurrente } from '@/types/domain'

export interface GastoRecurrenteFormProps {
  open: boolean
  recurrente?: GastoRecurrente | null
  categorias: CategoriaGasto[]
  empleados?: Empleado[]
  onClose: () => void
}

interface OpcionCategoria {
  id: string
  label: string
  clave: string | null
}

function opcionesCategoria(arbol: readonly CategoriaGasto[]): OpcionCategoria[] {
  const out: OpcionCategoria[] = []
  for (const c of arbol) {
    if (!c.activo) continue
    out.push({ id: c.id, label: c.nombre, clave: c.clave })
    for (const s of c.subcategorias ?? []) {
      if (s.activo) out.push({ id: s.id, label: `${c.nombre} › ${s.nombre}`, clave: s.clave })
    }
  }
  return out
}

export function GastoRecurrenteForm({
  open,
  recurrente,
  categorias,
  empleados = [],
  onClose,
}: GastoRecurrenteFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const hoy = fechaHoy()

  const opciones = React.useMemo(() => opcionesCategoria(categorias), [categorias])
  const empleadosActivos = React.useMemo(() => empleados.filter((e) => e.activo), [empleados])

  const resolver = zodResolver(gastoRecurrenteSchema) as unknown as Resolver<
    GastoRecurrenteInput,
    unknown,
    GastoRecurrenteValues
  >
  const methods = useForm<GastoRecurrenteInput, unknown, GastoRecurrenteValues>({
    resolver,
    defaultValues: {
      nombre: recurrente?.nombre ?? '',
      categoria_id: recurrente?.categoria_id ?? '',
      empleado_id: recurrente?.empleado_id ?? '',
      descripcion: recurrente?.descripcion ?? '',
      beneficiario: recurrente?.beneficiario ?? '',
      moneda: recurrente?.moneda ?? 'usd',
      monto: recurrente?.monto ?? null,
      frecuencia: recurrente?.frecuencia ?? 'mensual',
      dia_mes: recurrente?.dia_mes ?? 1,
      fecha_inicio: recurrente?.fecha_inicio ?? hoy,
      fecha_fin: recurrente?.fecha_fin ?? '',
      metodo_pago: recurrente?.metodo_pago ?? null,
      activo: recurrente?.activo ?? true,
    },
    disabled: isPending,
  })

  const { control, register, handleSubmit, setError, setValue, formState } = methods
  const [categoriaId, empleadoId, frecuencia, diaMes, fechaInicio, fechaFin, moneda] = useWatch({
    control,
    name: ['categoria_id', 'empleado_id', 'frecuencia', 'dia_mes', 'fecha_inicio', 'fecha_fin', 'moneda'],
  })

  const catActual = opciones.find((o) => o.id === categoriaId)
  const esNomina = catActual?.clave === 'nomina'

  // Al elegir empleado en nómina, sugerir moneda y salario si no hay monto
  React.useEffect(() => {
    if (esNomina && empleadoId) {
      const emp = empleadosActivos.find((e) => e.id === empleadoId)
      if (emp) {
        setValue('moneda', emp.moneda)
        if (emp.nombre && !methods.getValues('beneficiario')) {
          setValue('beneficiario', emp.nombre)
        }
      }
    }
  }, [esNomina, empleadoId, empleadosActivos, setValue, methods])

  // Próximas 3 fechas programadas
  const proximas = React.useMemo(() => {
    if (!fechaInicio) return []
    const diaNum = typeof diaMes === 'number' ? diaMes : diaMes ? Number(diaMes) : null
    return proximasFechas(
      {
        frecuencia,
        dia_mes: frecuencia === 'mensual' ? (diaNum ?? 28) : null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
      },
      3
    )
  }, [frecuencia, diaMes, fechaInicio, fechaFin])

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const payload = {
        ...values,
        id: recurrente?.id,
      }
      const result = await guardarRecurrenteAction(payload)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          setError(campo as keyof GastoRecurrenteInput, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Plantilla recurrente guardada')
      onClose()
    })
  })

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="sm"
      title={recurrente ? 'Editar plantilla recurrente' : 'Nueva plantilla de gasto recurrente'}
      subtitle="Genera gastos periódicos en estado pendiente para confirmar e ingresar la tasa del día."
      onSubmit={onSubmit}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending}>
          {recurrente ? 'Guardar cambios' : 'Crear plantilla'}
        </Button>
      }
    >
      <FormProvider {...methods}>
        <Box sx={{ display: 'grid', gap: 3, pt: 1 }}>
          <FormSection titulo="1. Datos de la plantilla" ayuda="Identificación y categoría del gasto." primera>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Nombre de la plantilla"
                  placeholder="Ej. Alquiler de local principal"
                  fullWidth
                  required
                  {...register('nombre')}
                  error={Boolean(formState.errors.nombre)}
                  helperText={formState.errors.nombre?.message}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="categoria_id"
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      options={opciones}
                      getOptionLabel={(o) => o.label}
                      isOptionEqualToValue={(o, v) => o.id === v.id}
                      value={opciones.find((o) => o.id === field.value) ?? null}
                      onChange={(_e, val) => field.onChange(val?.id ?? '')}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Categoría"
                          required
                          error={Boolean(fieldState.error)}
                          helperText={fieldState.error?.message}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              {esNomina ? (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="empleado_id"
                    render={({ field, fieldState }) => (
                      <TextField
                        select
                        fullWidth
                        label="Empleado"
                        required
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={Boolean(fieldState.error)}
                        helperText={fieldState.error?.message ?? 'Nómina requiere un empleado activo'}
                      >
                        <MenuItem value="">Selecciona un empleado…</MenuItem>
                        {empleadosActivos.map((e) => (
                          <MenuItem key={e.id} value={e.id}>
                            {e.nombre} ({e.cedula})
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              ) : null}

              <Grid size={{ xs: 12, sm: esNomina ? 6 : 12 }}>
                <TextField
                  label="Descripción"
                  placeholder="Concepto del gasto periódico"
                  fullWidth
                  required
                  {...register('descripcion')}
                  error={Boolean(formState.errors.descripcion)}
                  helperText={formState.errors.descripcion?.message}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Beneficiario (opcional)"
                  placeholder="Persona o empresa que recibe el pago"
                  fullWidth
                  {...register('beneficiario')}
                  error={Boolean(formState.errors.beneficiario)}
                  helperText={formState.errors.beneficiario?.message}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="metodo_pago"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="Método de pago sugerido"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    >
                      <MenuItem value="">Sin método preferido</MenuItem>
                      {METODOS_PAGO_GASTO.map((m) => (
                        <MenuItem key={m} value={m}>
                          {ETIQUETA_METODO[m]}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
            </Grid>
          </FormSection>

          <FormSection titulo="2. Frecuencia y período" ayuda="Cuándo se genera cada gasto pendiente.">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="frecuencia"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="Frecuencia"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <MenuItem value="mensual">Mensual</MenuItem>
                      <MenuItem value="quincenal">Quincenal (días 15 y fin de mes)</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>

              {frecuencia === 'mensual' ? (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    control={control}
                    name="dia_mes"
                    render={({ field, fieldState }) => (
                      <TextField
                        select
                        fullWidth
                        label="Día del mes programado"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        error={Boolean(fieldState.error)}
                        helperText={fieldState.error?.message ?? 'O último día si no se especifica'}
                      >
                        <MenuItem value="">Último día del mes</MenuItem>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <MenuItem key={d} value={d}>
                            Día {d}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              ) : null}

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="date"
                  label="Fecha de inicio"
                  fullWidth
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...register('fecha_inicio')}
                  error={Boolean(formState.errors.fecha_inicio)}
                  helperText={formState.errors.fecha_inicio?.message}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="date"
                  label="Fecha de fin (opcional)"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...register('fecha_fin')}
                  error={Boolean(formState.errors.fecha_fin)}
                  helperText={formState.errors.fecha_fin?.message ?? 'Dejar vacío si es indefinido'}
                />
              </Grid>

              {proximas.length > 0 ? (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
                      Próximas fechas programadas:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {proximas.map((f) => (
                        <Chip key={f} label={formatFecha(f)} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              ) : null}
            </Grid>
          </FormSection>

          <FormSection titulo="3. Importe estimado" ayuda="Monto que tendrá el pendiente al generarse.">
            <Grid container spacing={2} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="moneda"
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      value={field.value}
                      onChange={(_e, v) => v && field.onChange(v)}
                    >
                      <ToggleButton value="usd">USD ($)</ToggleButton>
                      <ToggleButton value="bs">Bs</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 8 }}>
                <Controller
                  control={control}
                  name="monto"
                  render={({ field, fieldState }) => (
                    <NumberField
                      label={esNomina ? 'Monto fijo (o dejar vacío para salario vigente)' : 'Monto fijo'}
                      value={typeof field.value === 'number' ? field.value : null}
                      onChange={field.onChange}
                      prefix={moneda === 'usd' ? '$ ' : 'Bs '}
                      decimals={2}
                      fullWidth
                      error={Boolean(fieldState.error)}
                      helperText={
                        fieldState.error?.message ??
                        (esNomina ? 'Si queda vacío, tomará el salario base del empleado (o mitad en quincena).' : undefined)
                      }
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
