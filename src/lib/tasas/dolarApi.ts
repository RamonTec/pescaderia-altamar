import { z } from 'zod'

/**
 * dolarapi (08-tasas): espejo del oficial del BCV y única fuente de la tasa
 * paralela. Solo servidor. Reemplaza a `fetchTasaRemota` del viejo
 * `rateService`. Si falla (timeout/HTTP/forma inesperada), devuelve `null` y
 * el llamador decide (la UI nunca lo nota).
 */

const DOLORES_URL = 'https://ve.dolarapi.com/v1/dolares'
const EUROS_URL = 'https://ve.dolarapi.com/v1/euros'
const TIMEOUT_MS = 10_000
const USER_AGENT = 'pescaderia-mvp/1.0 (gestion-pescaderia)'

/** Tasas de una fuente (oficial o paralela), USD y EUR en Bs. */
export interface ParDolarApi {
  usd: number
  eur: number
  /** Hora reportada por dolarapi para esta parte (ISO). */
  fechaActualizacion: string
}

export interface TasasDolarApi {
  oficial: ParDolarApi | null
  paralelo: ParDolarApi | null
  /** `fechaActualizacion` del oficial si vino; si no, el del paralelo. */
  fechaActualizacion?: string
}

// Ambos endpoints devuelven un ARRAY (verificado con curl el 2026-10-07):
// [{ moneda, fuente: 'oficial'|'paralelo', nombre, compra, venta, promedio,
//    fechaActualizacion }]. Se validan los campos que se usan.
const entradaSchema = z.object({
  moneda: z.string(),
  fuente: z.enum(['oficial', 'paralelo']),
  promedio: z.number().positive(),
  fechaActualizacion: z.string(),
})
const respuestaSchema = z.array(entradaSchema)

async function obtener(url: string): Promise<z.infer<typeof entradaSchema>[] | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const parseo = respuestaSchema.safeParse(await res.json())
    return parseo.success ? parseo.data : null
  } catch {
    return null
  }
}

function parDe(
  dolares: z.infer<typeof entradaSchema>[] | null,
  euros: z.infer<typeof entradaSchema>[] | null,
  fuente: 'oficial' | 'paralelo'
): ParDolarApi | null {
  const usd = dolares?.find((d) => d.fuente === fuente)
  const eur = euros?.find((e) => e.fuente === fuente)
  if (!usd || !eur) return null
  return { usd: usd.promedio, eur: eur.promedio, fechaActualizacion: usd.fechaActualizacion }
}

/**
 * Oficial (espejo del BCV) y paralelo, USD y EUR. `null` solo si no respondió
 * nada; si falta una parte, esa parte viene `null` y la otra se aprovecha.
 */
export async function obtenerTasasDolarApi(): Promise<TasasDolarApi | null> {
  const [dolares, euros] = await Promise.all([obtener(DOLORES_URL), obtener(EUROS_URL)])
  const oficial = parDe(dolares, euros, 'oficial')
  const paralelo = parDe(dolares, euros, 'paralelo')
  if (!oficial && !paralelo) return null
  return { oficial, paralelo, fechaActualizacion: oficial?.fechaActualizacion ?? paralelo?.fechaActualizacion }
}
