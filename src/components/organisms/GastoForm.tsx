'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Controller, FormProvider, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
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
  pedirConfirmacionTasaManual,
  TasaSelector,
  type ReferencialTasa,
  type TasaSelectorConfig,
} from '@/components/organisms/TasaSelector'
import {
  METODOS_PAGO_GASTO,
  editarGastoSchema,
  gastoFormSchema,
  pagoNominaSchema,
  type EditarGastoInput,
  type EditarGastoValues,
  type PagoNominaInput,
  type PagoNominaValues,
} from '@/lib/gastoValidation'
import { montoNominaPeriodo, montoUsdGasto } from '@/lib/gastos/montos'
import { atajosPeriodo, tipoPeriodoNomina } from '@/lib/gastos/periodos'
import { mapaCategorias, rutaCategoria, textoTasaGasto } from '@/lib/gastos/textos'
import { ETIQUETA_METODO } from '@/lib/dashboard/etiquetas'
import { fechaHoy, formatBs, formatFecha, formatUsd } from '@/lib/format'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import {
  confirmarGastoAction,
  editarGastoAction,
  pagosSolapadosAction,
  registrarGastoAction,
  registrarPagoNominaAction,
} from '@/app/(protected)/gastos/actions'
import type { CategoriaGasto, Empleado, Gasto, MetodoPago } from '@/types/domain'

/**
 * Modos de `GastoForm`. `nomina` (Fase B): pago de nómina con empleado y
 * período. `confirmar` (Fase C): pendientes de plantillas recurrentes.
 */
export type ModoGastoForm = 'crear' | 'editar' | 'registrar_de_nuevo' | 'nomina' | 'confirmar'

export interface GastoFormProps {
  open: boolean
  modo: ModoGastoForm
  /** Gasto de origen (`editar` y `registrar_de_nuevo`). */
  gasto?: Gasto | null
  /** Árbol de categorías (primer nivel con `subcategorias`). */
  categorias: CategoriaGasto[]
  configTasas: TasaSelectorConfig
  /** Empleados (modo `nomina`; solo los activos son elegibles). */
  empleados?: Empleado[]
  /** Empleado preseleccionado en modo `nomina` (ficha "Registrar pago"). */
  empleadoInicial?: string | null
  onClose: () => void
}

/**
 * Registro y edición de un gasto operativo (20-gastos), `AppDialog md`
 * (pantalla completa en `xs`). Montar con `key` para que tome los valores
 * iniciales al abrir.
 *
 * - `crear` / `registrar_de_nuevo`: secciones Gasto · Monto y tasa · Pago.
 *   `TasaSelector` resuelve la referencial por la fecha del gasto (o exige la
 *   manual) y la desviación de una manual se confirma al enviar. Equivalente
 *   en vivo (USD ↔ Bs). "Registrar de nuevo" precarga los datos de un gasto
 *   anulado como un gasto nuevo (P1).
 * - `editar` (P1 = b): el importe, la moneda, la tasa, la fecha y la
 *   categoría se muestran de solo lectura; cambian descripción,
 *   beneficiario, referencia y notas. Para corregir el importe: anular y
 *   registrar de nuevo.
 * - `nomina` (Fase B): la categoría es Nómina (la fija el servidor), con
 *   empleado activo y período (atajos 1.ª quincena / 2.ª quincena / Mes del
 *   mes de la fecha). Elegir empleado o período precarga monto y moneda con
 *   `montoNominaPeriodo` (P3: mes → salario, quincena → mitad), editables.
 *   Si otro pago confirmado del empleado tiene período solapado, se avisa
 *   (no se bloquea).
 */
export function GastoForm(props: GastoFormProps) {
  if (props.modo === 'editar' && props.gasto) {
    return <GastoEdicion {...props} gasto={props.gasto} />
  }
  return <GastoAlta {...props} />
}

/* ============================ Opciones de categoría ============================ */

interface OpcionCategoria {
  id: string
  label: string
  grupo: string
}

/** Activas y seleccionables en la Fase A (Nómina exige empleado: Fase B; en confirmar se permite). */
function opcionesCategoria(arbol: readonly CategoriaGasto[], permitirNomina = false): OpcionCategoria[] {
  const opciones: OpcionCategoria[] = []
  for (const c of arbol) {
    if (!c.activo) continue
    if (c.clave === 'nomina' && !permitirNomina) continue
    opciones.push({ id: c.id, label: c.nombre, grupo: c.nombre })
    for (const s of c.subcategorias ?? []) {
      if (s.activo) opciones.push({ id: s.id, label: `${c.nombre} › ${s.nombre}`, grupo: c.nombre })
    }
  }
  return opciones
}

function valoresIniciales(
  gasto: Gasto | null | undefined,
  opciones: readonly OpcionCategoria[],
  nomina: { categoriaId: string; empleadoId: string } | null
): PagoNominaInput {
  const hoy = fechaHoy()
  if (!gasto) {
    return {
      fecha: hoy,
      categoria_id: nomina?.categoriaId ?? '',
      empleado_id: nomina?.empleadoId ?? '',
      descripcion: '',
      beneficiario: '',
      moneda: 'bs',
      monto: null,
      tasa_origen: 'referencial',
      tasa_fuente: null,
      tasa: null,
      metodo_pago: null,
      referencia: '',
      notas: '',
      periodo_desde: '',
      periodo_hasta: '',
    }
  }
  const manual = gasto.tasa_origen === 'manual'
  return {
    fecha: gasto.fecha <= hoy ? gasto.fecha : hoy,
    categoria_id: nomina
      ? nomina.categoriaId
      : opciones.some((o) => o.id === gasto.categoria_id)
        ? gasto.categoria_id
        : '',
    empleado_id: nomina?.empleadoId ?? '',
    descripcion: gasto.descripcion,
    beneficiario: gasto.beneficiario ?? '',
    moneda: gasto.moneda,
    monto: gasto.monto,
    tasa_origen: manual ? 'manual' : 'referencial',
    tasa_fuente: gasto.tasa_fuente,
    tasa: manual ? gasto.tasa_snapshot : null,
    metodo_pago: gasto.metodo_pago,
    referencia: gasto.referencia ?? '',
    notas: gasto.notas ?? '',
    periodo_desde: gasto.periodo_desde ?? '',
    periodo_hasta: gasto.periodo_hasta ?? '',
  }
}

/* ============================ Alta ============================ */

/** Precarga a 2 decimales (lo que captura la UI), mitad hacia arriba. */
const a2Decimales = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const MES_CORTO = new Intl.DateTimeFormat('es-VE', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** «Nómina 1.ª quincena oct 2026», «Nómina oct 2026» o «Nómina 01/10/2026 – 20/10/2026». */
function descripcionNomina(desde: string, hasta: string): string {
  const tipo = tipoPeriodoNomina(desde, hasta)
  if (!tipo) return `Nómina ${formatFecha(desde)} – ${formatFecha(hasta)}`
  const [y, m] = desde.split('-').map(Number)
  const mes = MES_CORTO.format(new Date(Date.UTC(y, m - 1, 1))).replace('.', '')
  const etiqueta = tipo === 'mes' ? '' : tipo === 'primera_quincena' ? '1.ª quincena ' : '2.ª quincena '
  return `Nómina ${etiqueta}${mes}`
}

function GastoAlta({
  open,
  modo,
  gasto,
  categorias,
  configTasas,
  empleados = [],
  empleadoInicial = null,
  onClose,
}: GastoFormProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [referencial, setReferencial] = React.useState<ReferencialTasa | null>(null)
  const [avisoSolapado, setAvisoSolapado] = React.useState<string | null>(null)
  const consultaSolapado = React.useRef(0)
  const opciones = React.useMemo(() => opcionesCategoria(categorias, modo === 'confirmar'), [categorias, modo])
  const hoy = fechaHoy()

  const esNomina = modo === 'nomina'
  const esConfirmar = modo === 'confirmar'
  const categoriaNomina = categorias.find((c) => c.clave === 'nomina') ?? null
  const activos = React.useMemo(() => empleados.filter((e) => e.activo), [empleados])
  const empleadoDeOrigen = gasto?.empleado_id ?? empleadoInicial ?? ''
  const empleadoDeEntrada = esNomina ? (activos.find((e) => e.id === empleadoDeOrigen) ?? null) : null
  // Autos de descripción y beneficiario: se reemplazan solo si el admin no los cambió.
  const autoTextos = React.useRef({
    descripcion: '',
    beneficiario: !gasto && empleadoDeEntrada ? empleadoDeEntrada.nombre : '',
  })

  // Un solo formulario para el alta común y la nómina: en `crear` /
  // `registrar_de_nuevo` el esquema común descarta `empleado_id` (no se
  // envía); la salida solo se trata como pago de nómina en modo `nomina`.
  const resolver = (esNomina ? zodResolver(pagoNominaSchema) : zodResolver(gastoFormSchema)) as unknown as Resolver<
    PagoNominaInput,
    unknown,
    PagoNominaValues
  >
  const methods = useForm<PagoNominaInput, unknown, PagoNominaValues>({
    resolver,
    mode: 'onSubmit',
    defaultValues: {
      ...valoresIniciales(
        modo === 'registrar_de_nuevo' || esNomina || esConfirmar ? gasto : null,
        opciones,
        esNomina ? { categoriaId: categoriaNomina?.id ?? '', empleadoId: empleadoDeEntrada?.id ?? '' } : null
      ),
      ...(!gasto && empleadoDeEntrada ? { beneficiario: empleadoDeEntrada.nombre } : {}),
    },
    disabled: isPending,
  })
  const { control, register, handleSubmit, setError, setValue, getValues, formState } = methods
  const [fecha, moneda, monto] = useWatch({ control, name: ['fecha', 'moneda', 'monto'] })

  /** Aviso (sin bloqueo) de otro pago confirmado del empleado con período solapado. */
  const revisarSolapado = (empleadoId: string, desde: string, hasta: string) => {
    const n = ++consultaSolapado.current
    if (!empleadoId || !desde || !hasta || desde > hasta) {
      setAvisoSolapado(null)
      return
    }
    void pagosSolapadosAction({ empleado_id: empleadoId, periodo_desde: desde, periodo_hasta: hasta }).then((r) => {
      if (n === consultaSolapado.current) setAvisoSolapado(r.aviso ?? null)
    })
  }

  /** Precarga monto, moneda, descripción y beneficiario al elegir empleado o período (P3). */
  const precargarNomina = () => {
    const { empleado_id, periodo_desde, periodo_hasta, descripcion, beneficiario } = getValues()
    const emp = activos.find((e) => e.id === empleado_id)
    revisarSolapado(empleado_id, periodo_desde, periodo_hasta)
    if (!emp) return
    const opts = { shouldDirty: true, shouldValidate: formState.isSubmitted }
    if (periodo_desde && periodo_hasta && periodo_desde <= periodo_hasta) {
      const sugerido = montoNominaPeriodo(emp.salario_base, periodo_desde, periodo_hasta)
      if (sugerido !== null && sugerido > 0) {
        setValue('moneda', emp.moneda, opts)
        setValue('monto', a2Decimales(sugerido), opts)
      }
      const desc = descripcionNomina(periodo_desde, periodo_hasta)
      if (descripcion.trim() === '' || descripcion === autoTextos.current.descripcion) {
        setValue('descripcion', desc, opts)
        autoTextos.current.descripcion = desc
      }
    }
    if (beneficiario.trim() === '' || beneficiario === autoTextos.current.beneficiario) {
      setValue('beneficiario', emp.nombre, opts)
      autoTextos.current.beneficiario = emp.nombre
    }
  }

  const aplicarAtajo = (desde: string, hasta: string) => {
    const opts = { shouldDirty: true, shouldValidate: formState.isSubmitted }
    setValue('periodo_desde', desde, opts)
    setValue('periodo_hasta', hasta, opts)
    precargarNomina()
  }

  const [periodoDesde, periodoHasta] = useWatch({ control, name: ['periodo_desde', 'periodo_hasta'] })
  const regDesde = register('periodo_desde')
  const regHasta = register('periodo_hasta')
  const atajos = atajosPeriodo(fecha && fecha <= hoy ? fecha : hoy)
  const empleadoActual = (id: string) => activos.find((e) => e.id === id) ?? null

  const onSubmit = handleSubmit(async (values) => {
    const ok = await pedirConfirmacionTasaManual(confirm, values, referencial, configTasas.umbral_desviacion_tasa_pct)
    if (!ok) return
    setServerError(null)
    startTransition(async () => {
      let result: { error: string | null; success: string | null; fieldErrors?: Record<string, string>; info?: string | null }
      if (esConfirmar && gasto) {
        result = await confirmarGastoAction(gasto.id, values)
      } else if (esNomina) {
        result = await registrarPagoNominaAction(values)
      } else {
        result = await registrarGastoAction(values)
      }
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          if (campo in values) setError(campo as keyof PagoNominaInput, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? (esConfirmar ? 'Gasto confirmado' : 'Gasto registrado'))
      if (result.info) notify.info(result.info)
      onClose()
    })
  })

  const equivalencia = (tasa: number | null) => {
    if (monto == null || !(monto > 0) || tasa == null || !(tasa > 0)) return null
    return (
      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {moneda === 'bs'
          ? `Equivale a ${formatUsd(montoUsdGasto('bs', monto, tasa))}`
          : `Equivale a ${formatBs(monto * tasa)}`}
      </Typography>
    )
  }

  const opcionActual = (id: string) => opciones.find((o) => o.id === id) ?? null

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      title={
        esConfirmar
          ? 'Confirmar gasto pendiente'
          : esNomina
            ? (gasto ? 'Registrar de nuevo · nómina' : 'Pago de nómina')
            : modo === 'registrar_de_nuevo'
              ? 'Registrar de nuevo'
              : 'Registrar gasto'
      }
      subtitle={
        esConfirmar
          ? `Plantilla recurrente · Período ${formatFecha(gasto?.periodo_desde)} – ${formatFecha(gasto?.periodo_hasta)}`
          : gasto && (modo === 'registrar_de_nuevo' || esNomina)
            ? `Nuevo gasto con los datos del ${formatFecha(gasto.fecha)} · ${gasto.descripcion}`
            : esNomina
              ? 'Gasto de la categoría Nómina ligado al empleado y al período que cubre.'
              : 'Nace confirmado y cuenta en los totales del período por su fecha.'
      }
      onSubmit={(e) => {
        onSubmit(e)
      }}
      pending={isPending}
      dirty={formState.isDirty || !!gasto}
      error={serverError}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending}>
          {esConfirmar ? 'Confirmar gasto' : esNomina ? 'Registrar pago' : 'Registrar gasto'}
        </Button>
      }
    >
      <FormProvider {...methods}>
        {esNomina && avisoSolapado ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {avisoSolapado}. Puedes registrarlo igual.
          </Alert>
        ) : null}
        <FormSection titulo="Gasto" primera>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Fecha *"
                type="date"
                fullWidth
                size="small"
                {...register('fecha')}
                error={!!formState.errors.fecha}
                helperText={formState.errors.fecha?.message}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy } }}
              />
            </Grid>
            {esNomina ? (
              <Grid size={{ xs: 12, sm: 8 }}>
                <Controller
                  control={control}
                  name="empleado_id"
                  render={({ field }) => (
                    <Autocomplete
                      options={activos}
                      getOptionLabel={(e) => `${e.nombre} · ${e.cedula}`}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      value={empleadoActual(field.value)}
                      onChange={(_, e) => {
                        field.onChange(e?.id ?? '')
                        precargarNomina()
                      }}
                      onBlur={field.onBlur}
                      disabled={formState.disabled}
                      noOptionsText="Sin empleados activos"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Empleado *"
                          size="small"
                          inputRef={field.ref}
                          error={!!formState.errors.empleado_id}
                          helperText={
                            formState.errors.empleado_id?.message ??
                            (activos.length === 0 ? 'Registra un empleado en la pestaña Empleados.' : 'Categoría: Nómina.')
                          }
                        />
                      )}
                    />
                  )}
                />
              </Grid>
            ) : (
            <Grid size={{ xs: 12, sm: 8 }}>
              <Controller
                control={control}
                name="categoria_id"
                render={({ field }) => (
                  <Autocomplete
                    options={opciones}
                    groupBy={(o) => o.grupo}
                    getOptionLabel={(o) => o.label}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    value={opcionActual(field.value)}
                    onChange={(_, o) => field.onChange(o?.id ?? '')}
                    onBlur={field.onBlur}
                    disabled={formState.disabled}
                    noOptionsText="Sin categorías activas"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Categoría *"
                        size="small"
                        inputRef={field.ref}
                        error={!!formState.errors.categoria_id}
                        helperText={formState.errors.categoria_id?.message}
                      />
                    )}
                  />
                )}
              />
            </Grid>
            )}
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField
                label="Descripción *"
                fullWidth
                size="small"
                {...register('descripcion')}
                error={!!formState.errors.descripcion}
                helperText={formState.errors.descripcion?.message ?? 'Concepto del gasto.'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Beneficiario"
                fullWidth
                size="small"
                {...register('beneficiario')}
                error={!!formState.errors.beneficiario}
                helperText={formState.errors.beneficiario?.message ?? 'A quién se pagó.'}
              />
            </Grid>
            {esNomina ? (
              <Grid size={12}>
                <Box role="group" aria-label="Atajos de período" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {atajos.map((a) => {
                    const activo = periodoDesde === a.desde && periodoHasta === a.hasta
                    return (
                      <Chip
                        key={a.tipo}
                        label={a.label}
                        variant={activo ? 'soft' : 'outlined'}
                        color={activo ? 'primary' : 'default'}
                        aria-pressed={activo}
                        disabled={formState.disabled}
                        onClick={() => aplicarAtajo(a.desde, a.hasta)}
                      />
                    )
                  })}
                </Box>
              </Grid>
            ) : null}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={esNomina ? 'Período desde *' : 'Período desde'}
                type="date"
                fullWidth
                size="small"
                {...regDesde}
                onChange={(e) => {
                  void regDesde.onChange(e).then(() => {
                    if (esNomina) precargarNomina()
                  })
                }}
                error={!!formState.errors.periodo_desde}
                helperText={
                  formState.errors.periodo_desde?.message ??
                  (esNomina ? 'Período que cubre el pago.' : 'Opcional: período que cubre.')
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={esNomina ? 'Período hasta *' : 'Período hasta'}
                type="date"
                fullWidth
                size="small"
                {...regHasta}
                onChange={(e) => {
                  void regHasta.onChange(e).then(() => {
                    if (esNomina) precargarNomina()
                  })
                }}
                error={!!formState.errors.periodo_hasta}
                helperText={formState.errors.periodo_hasta?.message}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
          </Grid>
        </FormSection>

        <FormSection
          titulo="Monto y tasa"
          ayuda={
            esNomina
              ? 'Precargado con el salario del empleado (mensual; la quincena, la mitad). Puedes ajustarlo.'
              : 'Los totales se suman en USD con la tasa de este gasto.'
          }
        >
          <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Controller
                  control={control}
                  name="moneda"
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={field.value}
                      disabled={formState.disabled}
                      onChange={(_, next: 'usd' | 'bs' | null) => {
                        if (next) field.onChange(next)
                      }}
                      aria-label="Moneda del gasto"
                    >
                      <ToggleButton value="bs">En Bs</ToggleButton>
                      <ToggleButton value="usd">En USD</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
                <Controller
                  control={control}
                  name="monto"
                  render={({ field }) => (
                    <NumberField
                      label={`Monto (${moneda === 'usd' ? 'USD' : 'Bs'}) *`}
                      fullWidth
                      size="small"
                      decimals={2}
                      prefix={moneda === 'usd' ? '$' : 'Bs'}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      disabled={formState.disabled}
                      error={!!formState.errors.monto}
                      helperText={formState.errors.monto?.message}
                    />
                  )}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TasaSelector
                fecha={fecha && fecha <= hoy ? fecha : hoy}
                config={configTasas}
                onReferencial={setReferencial}
                renderEquivalencia={equivalencia}
                titulo="Tasa del gasto"
              />
            </Grid>
          </Grid>
        </FormSection>

        <FormSection titulo="Pago">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                control={control}
                name="metodo_pago"
                render={({ field }) => (
                  <TextField
                    select
                    label="Método"
                    fullWidth
                    size="small"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : (e.target.value as MetodoPago))}
                    disabled={formState.disabled}
                    error={!!formState.errors.metodo_pago}
                    helperText={formState.errors.metodo_pago?.message}
                  >
                    <MenuItem value="">Sin indicar</MenuItem>
                    {METODOS_PAGO_GASTO.map((m) => (
                      <MenuItem key={m} value={m}>
                        {ETIQUETA_METODO[m]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Referencia"
                fullWidth
                size="small"
                {...register('referencia')}
                error={!!formState.errors.referencia}
                helperText={formState.errors.referencia?.message ?? 'N.º de transferencia, factura del servicio…'}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Notas"
                fullWidth
                size="small"
                multiline
                minRows={2}
                {...register('notas')}
                error={!!formState.errors.notas}
                helperText={formState.errors.notas?.message}
              />
            </Grid>
          </Grid>
        </FormSection>
      </FormProvider>
    </AppDialog>
  )
}

/* ============================ Edición (P1) ============================ */

function GastoEdicion({ open, gasto, categorias, onClose }: GastoFormProps & { gasto: Gasto }) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const mapa = React.useMemo(() => mapaCategorias(categorias), [categorias])

  const { register, handleSubmit, setError, formState } = useForm<EditarGastoInput, unknown, EditarGastoValues>({
    resolver: zodResolver(editarGastoSchema),
    defaultValues: {
      id: gasto.id,
      descripcion: gasto.descripcion,
      beneficiario: gasto.beneficiario ?? '',
      referencia: gasto.referencia ?? '',
      notas: gasto.notas ?? '',
    },
    disabled: isPending,
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const result = await editarGastoAction(values)
      if (result.error) {
        setServerError(result.error)
        for (const [campo, mensaje] of Object.entries(result.fieldErrors ?? {})) {
          if (campo in values) setError(campo as keyof EditarGastoInput, { type: 'server', message: mensaje })
        }
        return
      }
      notify.success(result.success ?? 'Gasto actualizado')
      onClose()
    })
  })

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      title="Editar gasto"
      subtitle={`${formatFecha(gasto.fecha)} · ${rutaCategoria(mapa, gasto.categoria_id)}`}
      onSubmit={(e) => {
        onSubmit(e)
      }}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending}>
          Guardar cambios
        </Button>
      }
    >
      <FormSection
        titulo="Importe"
        ayuda="Un gasto confirmado no cambia de importe, moneda, tasa, fecha ni categoría. Para corregirlo, anúlalo y usa «Registrar de nuevo»."
        primera
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          <Dato label="Fecha" value={formatFecha(gasto.fecha)} />
          <Dato label="Monto" value={gasto.moneda === 'bs' ? formatBs(gasto.monto) : formatUsd(gasto.monto)} />
          <Dato label="Monto USD" value={gasto.monto_usd !== null ? formatUsd(gasto.monto_usd) : '—'} />
          <Dato label="Tasa" value={textoTasaGasto(gasto)} />
        </Box>
      </FormSection>
      <FormSection titulo="Datos editables">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 7 }}>
            <TextField
              label="Descripción *"
              fullWidth
              size="small"
              {...register('descripcion')}
              error={!!formState.errors.descripcion}
              helperText={formState.errors.descripcion?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField
              label="Beneficiario"
              fullWidth
              size="small"
              {...register('beneficiario')}
              error={!!formState.errors.beneficiario}
              helperText={formState.errors.beneficiario?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Referencia"
              fullWidth
              size="small"
              {...register('referencia')}
              error={!!formState.errors.referencia}
              helperText={formState.errors.referencia?.message}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Notas"
              fullWidth
              size="small"
              multiline
              minRows={2}
              {...register('notas')}
              error={!!formState.errors.notas}
              helperText={formState.errors.notas?.message}
            />
          </Grid>
        </Grid>
      </FormSection>
    </AppDialog>
  )
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  )
}
