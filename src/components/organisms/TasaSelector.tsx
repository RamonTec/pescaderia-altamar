'use client'

import * as React from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Fade from '@mui/material/Fade'
import FormControlLabel from '@mui/material/FormControlLabel'
import Skeleton from '@mui/material/Skeleton'
import Switch from '@mui/material/Switch'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { TasaChip } from '@/components/molecules/TasaChip'
import { formatTasa } from '@/lib/format'
import { desviacionPct } from '@/lib/tasaValidation'
import { MSG_TASA_SIN_REFERENCIAL } from '@/lib/validationMessages'
import { type ConfirmOptions } from '@/lib/useConfirm'
import { getTasaVigenteAction } from '@/app/(protected)/tasas/actions'

const FUENTE_LABEL = { bcv: 'BCV', paralela: 'Paralela' } as const

/** Firma de `useConfirm()`, para que el form dueño pase su propio hook. */
export type Confirmar = (options: ConfirmOptions) => Promise<boolean>

/**
 * Confirmación del umbral de desviación al enviar (08-tasas): la tasa manual
 * difiere más de `umbralPct` % de la referencial que el selector reportó.
 * La lógica vive con el selector; el form dueño la llama al comienzo de su
 * `onSubmit` y aborta si devuelve `false`.
 */
export async function pedirConfirmacionTasaManual(
  confirm: Confirmar,
  input: { tasa_origen: 'referencial' | 'manual'; tasa: number | null },
  referencial: ReferencialTasa | null,
  umbralPct: number
): Promise<boolean> {
  if (input.tasa_origen !== 'manual' || !referencial || input.tasa == null) return true
  const desviacion = desviacionPct(input.tasa, referencial.valor)
  if (desviacion == null || Math.abs(desviacion) <= umbralPct) return true
  return confirm({
    title: 'Confirmar tasa manual',
    message: `La tasa difiere ${Math.abs(desviacion).toFixed(1)} % de la referencial (${formatTasa(
      referencial.valor
    )} ${FUENTE_LABEL[referencial.fuente]}). ¿Confirmas?`,
    confirmLabel: 'Confirmar tasa',
  })
}

/**
 * Config de tasas que las pages pasan a los forms (el shape de
 * `tasaService.getConfigTasas`, desde `config_negocio`).
 */
export interface TasaSelectorConfig {
  fuente_tasa_default: 'bcv' | 'paralela'
  umbral_desviacion_tasa_pct: number
}

/** Referencial vigente que el selector expone al form dueño. */
export interface ReferencialTasa {
  valor: number
  /** Fuente con la que se consultó (BCV o paralela). */
  fuente: 'bcv' | 'paralela'
  fecha_valor: string
  arrastrada: boolean
}

/**
 * Campos de tasa que el form dueño debe declarar (los de `camposTasa` /
 * `camposTasaOpcionales` de `tasaValidation`). El selector los lee y
 * escribe vía `FormProvider` con este recorte del tipo del form.
 */
export interface CamposTasaForm {
  tasa_origen: 'referencial' | 'manual'
  tasa_fuente?: 'bcv' | 'paralela' | null
  tasa: number | null
}

export interface TasaSelectorProps {
  /**
   * Fecha de la operación (YYYY-MM-DD): la referencial depende de ella (una
   * compra con fecha de ayer propone la vigente de ayer, spec 08-tasas).
   */
  fecha: string
  config: TasaSelectorConfig
  /**
   * Notifica la referencial vigente cada vez que cambia (fecha/fuente) o
   * `null` si no hay ninguna. El form lo usa para la confirmación del
   * umbral al enviar y para la equivalencia en vivo.
   */
  onReferencial?: (referencial: ReferencialTasa | null) => void
  /**
   * Equivalencia en vivo (Bs ↔ USD) con la tasa elegida: recibe el valor
   * final y devuelve el nodo que el form ya muestra. `null` para omitirla.
   */
  renderEquivalencia?: ((tasaFinal: number | null) => React.ReactNode) | null
  /** Título del bloque; por defecto "Tasa". */
  titulo?: string
}

/**
 * Selector de tasa de una operación (08-tasas): referencial (BCV/paralela,
 * resuelta por fecha en el servidor) o manual. Escribe `tasa_origen`,
 * `tasa_fuente` y `tasa` (valor final) en el form dueño, que debe envolverlo
 * en su `FormProvider` (patrón estándar de RHF para campos compartidos).
 *
 * - Al montar y al cambiar fecha/fuente consulta `getTasaVigenteAction` con
 *   debounce de 300 ms (consulta de solo lectura: no bloquea el submit);
 *   mientras carga muestra `Skeleton` y el valor llega con `Fade`.
 * - Sin referencial disponible: exige manual con el mensaje del spec y no
 *   permite volver al modo referencial.
 * - La desviación contra la referencial se muestra en vivo; si supera el
 *   umbral de config, el texto pasa a advertencia. La `ConfirmDialog` al
 *   enviar la maneja el propio form con `onReferencial` (mismo patrón que
 *   `pedirConfirmacionLimite` de `PedidoForm`).
 * - El campo manual aparece/desaparece con `Collapse`; el interruptor
 *   prellena con la referencial visible.
 */
export function TasaSelector({
  fecha,
  config,
  onReferencial,
  renderEquivalencia = null,
  titulo = 'Tasa',
}: TasaSelectorProps) {
  const { control, setValue, formState } = useFormContext<CamposTasaForm>()
  const tasaOrigen = useWatch({ control, name: 'tasa_origen' })
  const tasaFuente = useWatch({ control, name: 'tasa_fuente' })
  const tasaManual = useWatch({ control, name: 'tasa' })

  const [referencial, setReferencial] = React.useState<ReferencialTasa | null>(null)
  const [cargando, setCargando] = React.useState(true)
  const fuente = tasaFuente ?? config.fuente_tasa_default

  // La fuente arranca con la default de config si el form no la fijó.
  React.useEffect(() => {
    if (tasaFuente == null) {
      setValue('tasa_fuente', config.fuente_tasa_default, { shouldDirty: false })
    }
    // Solo al montar: la config no cambia mientras el form está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Referencial según fecha + fuente, con debounce (consulta de solo
  // lectura: cancela la anterior y no bloquea botones).
  React.useEffect(() => {
    let vigente = true
    const timer = setTimeout(async () => {
      setCargando(true)
      const data = await getTasaVigenteAction({ fecha, fuente })
      if (!vigente) return
      if (data.valor != null && data.fecha_valor) {
        const ref: ReferencialTasa = {
          valor: data.valor,
          fuente,
          fecha_valor: data.fecha_valor,
          arrastrada: data.arrastrada,
        }
        setReferencial(ref)
        onReferencial?.(ref)
        // En modo referencial la tasa final es la vigente del servidor.
        if (tasaOrigen === 'referencial') {
          setValue('tasa', ref.valor, { shouldDirty: false })
        }
      } else {
        setReferencial(null)
        onReferencial?.(null)
        // Sin referencial: la operación exige tasa manual (spec 08).
        setValue('tasa_origen', 'manual', { shouldDirty: false })
        setValue('tasa_fuente', fuente, { shouldDirty: false })
      }
      setCargando(false)
    }, 300)
    return () => {
      vigente = false
      clearTimeout(timer)
    }
    // `tasaOrigen` se lee al responder, no al consultar: alternar el
    // interruptor no debe relanzar la consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, fuente, setValue])

  const cambiarOrigen = (manual: boolean) => {
    if (manual) {
      setValue('tasa_origen', 'manual', { shouldDirty: true })
      // Arranca desde la referencial visible como punto de partida.
      if (tasaManual == null && referencial) {
        setValue('tasa', referencial.valor, { shouldDirty: true })
      }
    } else {
      if (!referencial) return // Sin referencial la manual es obligatoria.
      setValue('tasa_origen', 'referencial', { shouldDirty: true })
      setValue('tasa', referencial.valor, { shouldDirty: true })
    }
  }

  const tasaFinal =
    tasaOrigen === 'manual' ? (tasaManual ?? null) : referencial ? referencial.valor : null

  const desviacion =
    tasaOrigen === 'manual' && tasaManual != null && referencial
      ? desviacionPct(tasaManual, referencial.valor)
      : null
  const desviacionGrande = desviacion != null && Math.abs(desviacion) > config.umbral_desviacion_tasa_pct

  const errorTasa = formState.errors.tasa?.message
  const errorFuente = formState.errors.tasa_fuente?.message
  const sinReferencial = !cargando && referencial == null

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Typography variant="h6">{titulo}</Typography>

      {cargando ? (
        <Box sx={{ display: 'grid', gap: 1 }} aria-busy>
          <Skeleton variant="rounded" height={40} width={220} />
          <Skeleton variant="text" width={180} />
        </Box>
      ) : sinReferencial ? (
        <Alert severity="warning">{MSG_TASA_SIN_REFERENCIAL}</Alert>
      ) : (
        <Fade in key={`${fecha}-${fuente}`}>
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Controller
                control={control}
                name="tasa_fuente"
                render={({ field }) => (
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={fuente}
                    onChange={(_, next) => next && field.onChange(next)}
                    aria-label="Fuente de la tasa referencial"
                  >
                    <ToggleButton value="bcv">BCV</ToggleButton>
                    <ToggleButton value="paralela">Paralela</ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
              {referencial ? (
                <TasaChip
                  valor={referencial.valor}
                  fuente={fuente}
                  fechaValor={referencial.fecha_valor}
                  arrastrada={referencial.arrastrada}
                />
              ) : null}
            </Box>
            {errorFuente ? (
              <Typography variant="caption" color="error">
                {errorFuente}
              </Typography>
            ) : null}
          </Box>
        </Fade>
      )}

      <FormControlLabel
        control={
          <Controller
            control={control}
            name="tasa_origen"
            render={({ field }) => (
              <Switch
                checked={field.value === 'manual'}
                onChange={(e) => cambiarOrigen(e.target.checked)}
              />
            )}
          />
        }
        label="Usar tasa manual"
      />

      <Collapse in={tasaOrigen === 'manual'}>
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Controller
            control={control}
            name="tasa"
            render={({ field }) => (
              <NumberField
                label="Tasa manual (Bs/USD) *"
                fullWidth
                decimals={6}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                autoFocus
                error={!!errorTasa}
                helperText={
                  errorTasa ??
                  (referencial
                    ? desviacionGrande
                      ? `Difiere ${desviacion!.toFixed(1)} % de la referencial (${formatTasa(
                          referencial.valor
                        )} ${FUENTE_LABEL[fuente]}): revisa que no sea un error de tipeo`
                      : `${desviacion != null && desviacion >= 0 ? '+' : ''}${desviacion?.toFixed(1) ?? '0,0'} % vs ${FUENTE_LABEL[fuente]}`
                    : 'No hay referencial con qué comparar')
                }
              />
            )}
          />
        </Box>
      </Collapse>

      {renderEquivalencia ? renderEquivalencia(tasaFinal) : null}
    </Box>
  )
}