const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const bsFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const kgFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

const tasaFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 6,
  maximumFractionDigits: 6,
})

/** Tasa con 2 decimales, para el indicador de la barra y tarjetas compactas (08-tasas). */
const tasaCortaFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatUsd(n: number): string {
  return usdFormatter.format(n)
}

export function formatBs(n: number): string {
  return `Bs. ${bsFormatter.format(n)}`
}

export function formatKg(n: number): string {
  return `${kgFormatter.format(n)} kg`
}

export function formatTasa(n: number): string {
  return tasaFormatter.format(n)
}

export function formatTasaCorta(n: number): string {
  return tasaCortaFormatter.format(n)
}

/** "hace 5 min", "hace 2 h", "hace 3 días" (08-tasas, tarjetas de /tasas). */
export function formatHace(iso: string | null | undefined): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const minutos = Math.round((Date.now() - fecha.getTime()) / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

const fechaFormatter = new Intl.DateTimeFormat('es-VE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/**
 * `2026-10-06` → `06 oct 2026`. Parsea la fecha como local: `new Date('2026-10-06')`
 * la toma como UTC y en Venezuela (UTC-4) mostraría el día anterior.
 */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return fechaFormatter.format(new Date(y, m - 1, d))
}

const isoLocalFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Caracas',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Fecha de hoy en Venezuela como `YYYY-MM-DD`. `toISOString()` da la fecha UTC:
 * desde las 8 p. m. hora local ya devuelve el día siguiente.
 */
export function fechaHoy(): string {
  return isoLocalFormatter.format(new Date())
}