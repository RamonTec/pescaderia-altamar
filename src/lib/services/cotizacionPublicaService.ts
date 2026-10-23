import type { ResultadoCotizacionPublica } from '@/types/domain'
import type { ICotizacionPublicaRepository } from '@/lib/repositories/interfaces'
import { makeCotizacionPublicaRepository } from '@/lib/repositories/cotizacionPublicaRepository'
import { createAnonClient } from '@/lib/supabase/anon'
import { tokenValido } from '@/lib/cotizaciones/enlace'

/**
 * Lectura del enlace público `/c/[token]` (21-cotizaciones, P7), sin sesión.
 * Usa solo el cliente anónimo sin cookies y la RPC `cotizacion_publica`.
 *
 * - `disponible`: la cotización vigente (solo campos públicos).
 * - `vencida`: solo el número y el contacto del negocio (sin gracia).
 * - `no_disponible`: solo el contacto; idéntico para token inexistente,
 *   regenerado, revocado, borrador o anulada.
 *
 * Un token con formato inválido no llega a la base: se pide solo el
 * contacto del negocio (la RPC con `null`).
 */
export async function getPorToken(
  token: string,
  repo: ICotizacionPublicaRepository = makeCotizacionPublicaRepository(createAnonClient())
): Promise<ResultadoCotizacionPublica> {
  if (!tokenValido(token)) {
    const r = await repo.porToken(null)
    return { resultado: 'no_disponible', negocio: r.negocio }
  }
  return repo.porToken(token)
}
