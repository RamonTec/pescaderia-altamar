import type { Tasa } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * RateService (SRP): solo gestión de tasas de cambio.
 * Estrategia de fuente: BCV/paralela desde API, con override manual.
 */

const PYDOLARVE_URLS: Record<string, string> = {
  bcv: 'https://ve.dolarapi.com/v1/dolares/oficial',
  paralela: 'https://ve.dolarapi.com/v1/dolares/paralelo',
}

export async function fetchTasaRemota(fuente: 'bcv' | 'paralela'): Promise<number | null> {
  try {
    const res = await fetch(PYDOLARVE_URLS[fuente], { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const json = (await res.json()) as { promedio?: number }
    return json.promedio ?? null
  } catch {
    return null
  }
}

export async function getTasaViva(fuente: 'bcv' | 'paralela' = 'bcv'): Promise<Tasa | null> {
  const db = createClient()
  const hoy = new Date().toISOString().slice(0, 10)
  const { data } = await db
    .from('tasas')
    .select('*')
    .eq('fecha', hoy)
    .in('fuente', [fuente, 'manual'])
    .order('created_at', { ascending: false })
    .limit(1)
  return (data?.[0] as Tasa) ?? null
}

export async function upsertTasaManual(
  fecha: string,
  fuente: 'bcv' | 'paralela' | 'manual',
  bsPorUsd: number
): Promise<Tasa> {
  const db = createClient()
  const { data, error } = await db
    .from('tasas')
    .upsert({ fecha, fuente, bs_por_usd: bsPorUsd }, { onConflict: 'fecha,fuente' })
    .select()
    .single()
  if (error) throw error
  return data as Tasa
}

export async function listTasas(limit = 30): Promise<Tasa[]> {
  const db = createClient()
  const { data, error } = await db
    .from('tasas')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as Tasa[]
}
