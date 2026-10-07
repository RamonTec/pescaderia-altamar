import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tasa } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'
import { fechaHoy } from '@/lib/format'

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

/**
 * Tasa registrada hoy para la fuente (o una manual del día).
 * `db` permite pasar el cliente de servidor: el de navegador no lleva la
 * sesión cuando se llama desde un Server Component o una Server Action.
 */
export async function getTasaViva(
  fuente: 'bcv' | 'paralela' = 'bcv',
  db: SupabaseClient = createClient()
): Promise<Tasa | null> {
  const hoy = fechaHoy()
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
