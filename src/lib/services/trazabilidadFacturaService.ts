import type { SupabaseClient } from '@supabase/supabase-js'
import type { DetalleFactura } from '@/types/domain'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { createClient } from '@/lib/supabase/server'
import { armarDetalleFactura } from '@/lib/facturas/detalle'
import { requireAdmin } from './authService'

/**
 * TrazabilidadFacturaService (17): ficha `/facturas/[id]`, solo admin (muestra
 * costos). Exige admin ANTES de llamar a la RPC `trazabilidad_factura` (que
 * además falla con `42501`). Márgenes y señales: funciones puras de
 * `lib/facturas`, con la tolerancia de `config_negocio`.
 */

export const MSG_SOLO_ADMIN_FACTURA = 'Solo un administrador puede ver el detalle de una factura'

export class PermisoFacturaError extends Error {
  readonly code = '42501'
  constructor(message = MSG_SOLO_ADMIN_FACTURA) {
    super(message)
    this.name = 'PermisoFacturaError'
  }
}

/** Ficha de la factura; `null` si no existe. */
export async function getDetalleFactura(id: string, db?: SupabaseClient): Promise<DetalleFactura | null> {
  if (!(await requireAdmin())) throw new PermisoFacturaError()
  const client = db ?? (await createClient())
  const [traza, config] = await Promise.all([
    makeFacturaRepository(client).getTrazabilidad(id),
    makeConfigNegocioRepository(client).get(),
  ])
  if (!traza) return null
  return armarDetalleFactura(traza, Number(config?.tolerancia_precio_ref_pct ?? 0))
}
