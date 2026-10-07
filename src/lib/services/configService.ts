import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConfigNegocio } from '@/types/domain'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { createClient } from '@/lib/supabase/server'
import { DIAS_CREDITO_DEFAULT } from './invoiceService'

/** Lecturas de la configuración del negocio para páginas del servidor. */

export async function getConfigNegocio(db?: SupabaseClient): Promise<ConfigNegocio | null> {
  const client = db ?? (await createClient())
  return makeConfigNegocioRepository(client).get()
}

/** Días de crédito por defecto (09-cuentas-por-cobrar): los de un cliente sin días propios. */
export async function getDiasCreditoDefault(db?: SupabaseClient): Promise<number> {
  const config = await getConfigNegocio(db)
  return Number(config?.dias_credito_default ?? DIAS_CREDITO_DEFAULT)
}
