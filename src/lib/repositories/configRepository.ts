import type { SupabaseClient } from '@supabase/supabase-js'
import type { IConfigNegocioRepository } from './interfaces'
import type { ConfigNegocio } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de configuración del negocio.
 * Tabla singleton `config_negocio` (una sola fila con id = 1).
 */

export function makeConfigNegocioRepository(
  db: SupabaseClient = createClient()
): IConfigNegocioRepository {
  return {
    async get() {
      const { data, error } = await db
        .from('config_negocio')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      return (data as ConfigNegocio | null) ?? null
    },
    async update(input) {
      const { data, error } = await db
        .from('config_negocio')
        .update(input)
        .eq('id', 1)
        .select()
        .single()
      if (error) throw error
      return data as ConfigNegocio
    },
  }
}

export const configNegocioRepository = makeConfigNegocioRepository()
