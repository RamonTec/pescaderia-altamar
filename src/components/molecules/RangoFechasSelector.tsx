'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/es'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { esES } from '@mui/x-date-pickers/locales'
import type { PresetRango, RangoFechas } from '@/types/domain'
import {
  ETIQUETA_PRESET,
  PRESETS_RANGO,
  presetDeRango,
  rangoDesdePreset,
  type PresetFijo,
} from '@/lib/dashboard/rangos'
import { rangoFechasSchema } from '@/lib/dashboardValidation'
import { formatFecha } from '@/lib/format'

export interface RangoFechasSelectorProps {
  /** Rango vigente (validado en el servidor). */
  rango: RangoFechas
  /** Hoy en Venezuela (`fechaHoy()` del servidor), para los presets. */
  hoy: string
  /** Nombre de los parámetros en la URL. */
  paramDesde?: string
  paramHasta?: string
}

const FORMATO = 'DD/MM/YYYY'
const localeText = esES.components.MuiLocalizationProvider.defaultProps.localeText

/**
 * Selector de rango de fechas (15-dashboard): chips de presets + "Personalizado"
 * con `DatePicker` desde/hasta. Escribe `?desde`/`?hasta` con `router.replace`
 * y conserva los demás parámetros. En `xs`, un `Select` y el personalizado en
 * un diálogo. La validación de fondo es la del servidor (`rangoFechasSchema`).
 */
export function RangoFechasSelector({
  rango,
  hoy,
  paramDesde = 'desde',
  paramHasta = 'hasta',
}: RangoFechasSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  const presetActual = presetDeRango(rango, hoy)
  const [personalizadoAbierto, setPersonalizadoAbierto] = React.useState(false)
  const [dialogoAbierto, setDialogoAbierto] = React.useState(false)
  const [desde, setDesde] = React.useState<Dayjs | null>(dayjs(rango.desde))
  const [hasta, setHasta] = React.useState<Dayjs | null>(dayjs(rango.hasta))
  const [error, setError] = React.useState<string | null>(null)

  // Si el rango cambia desde fuera (navegación), los pickers lo reflejan
  // (ajuste durante el render, sin efecto).
  const claveRango = `${rango.desde}|${rango.hasta}`
  const [claveVista, setClaveVista] = React.useState(claveRango)
  if (claveVista !== claveRango) {
    setClaveVista(claveRango)
    setDesde(dayjs(rango.desde))
    setHasta(dayjs(rango.hasta))
  }

  const aplicar = React.useCallback(
    (r: RangoFechas) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(paramDesde, r.desde)
      params.set(paramHasta, r.hasta)
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [pathname, paramDesde, paramHasta, router, searchParams]
  )

  const elegirPreset = (p: PresetFijo) => {
    setPersonalizadoAbierto(false)
    setError(null)
    aplicar(rangoDesdePreset(p, hoy))
  }

  /** Valida y aplica el personalizado; devuelve si se aplicó. */
  const aplicarPersonalizado = (): boolean => {
    const r = rangoFechasSchema.safeParse({
      desde: desde?.isValid() ? desde.format('YYYY-MM-DD') : '',
      hasta: hasta?.isValid() ? hasta.format('YYYY-MM-DD') : '',
    })
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? 'Rango inválido')
      return false
    }
    setError(null)
    aplicar(r.data)
    return true
  }

  const pickers = (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' }, gap: 1.5, alignItems: 'start' }}>
      <DatePicker
        label="Desde"
        value={desde}
        onChange={(v) => setDesde(v)}
        format={FORMATO}
        maxDate={dayjs(hoy)}
        slotProps={{ textField: { size: 'small', fullWidth: true } }}
      />
      <DatePicker
        label="Hasta"
        value={hasta}
        onChange={(v) => setHasta(v)}
        format={FORMATO}
        maxDate={dayjs(hoy)}
        slotProps={{
          textField: { size: 'small', fullWidth: true, error: Boolean(error), helperText: error ?? undefined },
        }}
      />
      <Button
        variant="outlined"
        onClick={aplicarPersonalizado}
        loading={pending}
        sx={{ display: { xs: 'none', sm: 'inline-flex' }, height: 40 }}
      >
        Aplicar rango
      </Button>
    </Box>
  )

  const opcionesSelect: PresetRango[] = [...PRESETS_RANGO, 'personalizado']

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es" localeText={localeText}>
      <Box sx={{ display: 'grid', gap: 1, minWidth: 0 }}>
        {/* sm+: chips */}
        <Box
          role="group"
          aria-label="Rango de fechas"
          sx={{ display: { xs: 'none', sm: 'flex' }, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
        >
          {PRESETS_RANGO.map((p) => (
            <Chip
              key={p}
              label={ETIQUETA_PRESET[p]}
              color={presetActual === p ? 'primary' : 'default'}
              variant={presetActual === p ? 'filled' : 'outlined'}
              aria-pressed={presetActual === p}
              onClick={() => elegirPreset(p)}
              disabled={pending}
            />
          ))}
          <Chip
            label={ETIQUETA_PRESET.personalizado}
            color={presetActual === 'personalizado' ? 'primary' : 'default'}
            variant={presetActual === 'personalizado' ? 'filled' : 'outlined'}
            aria-pressed={presetActual === 'personalizado'}
            aria-expanded={personalizadoAbierto}
            onClick={() => setPersonalizadoAbierto((v) => !v)}
            disabled={pending}
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 0.5 } }}>
            {formatFecha(rango.desde)} – {formatFecha(rango.hasta)}
          </Typography>
        </Box>
        <Collapse in={personalizadoAbierto} sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Box sx={{ pt: 1, maxWidth: 640 }}>{pickers}</Box>
        </Collapse>

        {/* xs: select + diálogo */}
        <Box sx={{ display: { xs: 'grid', sm: 'none' }, gap: 0.5 }}>
          <TextField
            select
            size="small"
            label="Rango de fechas"
            value={presetActual}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value as PresetRango
              if (v === 'personalizado') setDialogoAbierto(true)
              else elegirPreset(v)
            }}
            slotProps={{
              select: {
                renderValue: (v) =>
                  v === 'personalizado'
                    ? `${formatFecha(rango.desde)} – ${formatFecha(rango.hasta)}`
                    : ETIQUETA_PRESET[v as PresetRango],
              },
            }}
          >
            {opcionesSelect.map((p) => (
              <MenuItem key={p} value={p} onClick={p === 'personalizado' ? () => setDialogoAbierto(true) : undefined}>
                {ETIQUETA_PRESET[p]}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            {formatFecha(rango.desde)} – {formatFecha(rango.hasta)}
          </Typography>
        </Box>

        {pending ? <LinearProgress aria-label="Actualizando el período" sx={{ height: 2 }} /> : null}
      </Box>

      <Dialog
        open={dialogoAbierto}
        onClose={() => setDialogoAbierto(false)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="rango-personalizado-titulo"
      >
        <DialogTitle id="rango-personalizado-titulo" variant="h6">
          Rango personalizado
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>{pickers}</DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogoAbierto(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (aplicarPersonalizado()) setDialogoAbierto(false)
            }}
          >
            Aplicar rango
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}
