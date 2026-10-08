import type { GranularidadSpread, PresetRango, RangoFechas } from '@/types/domain'

/**
 * Rangos de fechas del dashboard (15). Puro: sin Supabase ni React. Todas las
 * fechas son `YYYY-MM-DD` (fecha del documento, America/Caracas) y se operan
 * en UTC para que el huso del servidor no corra el día.
 */

export type PresetFijo = Exclude<PresetRango, 'personalizado'>

/** Presets en el orden en que se muestran. */
export const PRESETS_RANGO: readonly PresetFijo[] = [
  'hoy',
  'ultimos_7',
  'mes_en_curso',
  'mes_anterior',
  'ultimos_90',
  'anio_en_curso',
] as const

export const PRESET_DEFAULT: PresetFijo = 'mes_en_curso'

export const ETIQUETA_PRESET: Record<PresetRango, string> = {
  hoy: 'Hoy',
  ultimos_7: 'Últimos 7 días',
  mes_en_curso: 'Mes en curso',
  mes_anterior: 'Mes anterior',
  ultimos_90: 'Últimos 90 días',
  anio_en_curso: 'Año en curso',
  personalizado: 'Personalizado',
}

/** Máximo de días entre `desde` y `hasta` (spec: 731). */
export const MAX_DIAS_RANGO = 731

/** Rango ≤ este número de días (`hasta − desde`) → spread por semana; si no, por mes. */
export const DIAS_MAX_SPREAD_SEMANAL = 120

const MS_DIA = 24 * 60 * 60 * 1000

function aUtc(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

export function sumarDias(iso: string, dias: number): string {
  return aIso(new Date(aUtc(iso).getTime() + dias * MS_DIA))
}

/** `b − a` en días. */
export function diferenciaDias(a: string, b: string): number {
  return Math.round((aUtc(b).getTime() - aUtc(a).getTime()) / MS_DIA)
}

export function inicioMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/** Suma meses a un `YYYY-MM-01`. */
export function sumarMeses(iso: string, meses: number): string {
  const f = aUtc(inicioMes(iso))
  return aIso(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + meses, 1)))
}

export function finMes(iso: string): string {
  return sumarDias(sumarMeses(iso, 1), -1)
}

/** Lunes de la semana ISO (igual que `date_trunc('week', …)` de Postgres). */
export function inicioSemana(iso: string): string {
  const dia = aUtc(iso).getUTCDay()
  return sumarDias(iso, -((dia + 6) % 7))
}

/** Rango de un preset fijo respecto de `hoy`. */
export function rangoDesdePreset(preset: PresetFijo, hoy: string): RangoFechas {
  switch (preset) {
    case 'hoy':
      return { desde: hoy, hasta: hoy }
    case 'ultimos_7':
      return { desde: sumarDias(hoy, -6), hasta: hoy }
    case 'mes_en_curso':
      return { desde: inicioMes(hoy), hasta: hoy }
    case 'mes_anterior': {
      const desde = sumarMeses(hoy, -1)
      return { desde, hasta: finMes(desde) }
    }
    case 'ultimos_90':
      return { desde: sumarDias(hoy, -89), hasta: hoy }
    case 'anio_en_curso':
      return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy }
  }
}

/** Preset que produce exactamente ese rango hoy, o `personalizado`. */
export function presetDeRango(rango: RangoFechas, hoy: string): PresetRango {
  for (const p of PRESETS_RANGO) {
    const r = rangoDesdePreset(p, hoy)
    if (r.desde === rango.desde && r.hasta === rango.hasta) return p
  }
  return 'personalizado'
}

/** Semana si el rango tiene ≤ 120 días (`hasta − desde`), si no mes (B5). */
export function granularidadSpread(rango: RangoFechas): GranularidadSpread {
  return diferenciaDias(rango.desde, rango.hasta) <= DIAS_MAX_SPREAD_SEMANAL ? 'semana' : 'mes'
}

/** D6: los 12 meses (`YYYY-MM-01`) que terminan en el mes de `hasta`, del más antiguo al más reciente. */
export function mesesVentas(hasta: string): string[] {
  return Array.from({ length: 12 }, (_, i) => sumarMeses(hasta, i - 11))
}

/** Inicios de período (semana o mes) que cubren el rango, en orden. */
export function periodosDelRango(rango: RangoFechas, granularidad: GranularidadSpread): string[] {
  const periodos: string[] = []
  if (granularidad === 'semana') {
    for (let p = inicioSemana(rango.desde); p <= rango.hasta; p = sumarDias(p, 7)) periodos.push(p)
  } else {
    for (let p = inicioMes(rango.desde); p <= rango.hasta; p = sumarMeses(p, 1)) periodos.push(p)
  }
  return periodos
}

/** Días consecutivos desde `desde` (inclusive). */
export function diasDesde(desde: string, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => sumarDias(desde, i))
}
