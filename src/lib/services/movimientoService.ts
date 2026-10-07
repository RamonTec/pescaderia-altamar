import type { SupabaseClient } from '@supabase/supabase-js'
import type { TipoMovimiento } from '@/types/domain'
import type { MovimientoNuevo } from '@/lib/repositories/interfaces'
import { makeMovimientoRepository } from '@/lib/repositories/movimientoRepository'

/**
 * MovimientoService (SRP): única puerta de entrada al ledger `movimientos`.
 *
 * Factory `crearMovimiento`: el signo de `peso_kg` lo decide el tipo, no quien
 * llama — entradas (`compra`, `proceso_in`) positivas, salidas (`proceso_out`,
 * `venta`) negativas; `ajuste` respeta el signo recibido. Así ningún servicio
 * puede registrar una compra que reste stock por error.
 *
 * Los flujos que necesitan atomicidad (una compra y sus movimientos) construyen
 * los movimientos con la factory y los pasan a su RPC transaccional; los
 * movimientos sueltos se escriben con `registrarMovimiento`.
 */

const ENTRADAS: ReadonlySet<TipoMovimiento> = new Set(['compra', 'proceso_in'])
const SALIDAS: ReadonlySet<TipoMovimiento> = new Set(['proceso_out', 'venta'])

const redondea = (n: number, decimales: number) => {
  const f = 10 ** decimales
  return Math.round(n * f) / f
}

export function crearMovimiento(
  tipo: TipoMovimiento,
  productoId: string,
  pesoKg: number,
  costoUsdKg: number,
  refId: string | null
): MovimientoNuevo {
  if (!Number.isFinite(pesoKg) || pesoKg === 0) {
    throw new Error('El peso del movimiento debe ser distinto de cero')
  }
  if (!Number.isFinite(costoUsdKg) || costoUsdKg < 0) {
    throw new Error('El costo del movimiento no puede ser negativo')
  }

  const magnitud = Math.abs(pesoKg)
  const peso = ENTRADAS.has(tipo) ? magnitud : SALIDAS.has(tipo) ? -magnitud : pesoKg

  return {
    producto_id: productoId,
    tipo,
    // numeric(12,3) para kg y numeric(14,6) para dinero (/SPEC.md §5).
    peso_kg: redondea(peso, 3),
    costo_usd_kg: redondea(costoUsdKg, 6),
    ref_id: refId,
  }
}

export async function registrarMovimiento(
  db: SupabaseClient,
  tipo: TipoMovimiento,
  productoId: string,
  pesoKg: number,
  costoUsdKg: number,
  refId: string | null
): Promise<MovimientoNuevo> {
  const movimiento = crearMovimiento(tipo, productoId, pesoKg, costoUsdKg, refId)
  await makeMovimientoRepository(db).create(movimiento)
  return movimiento
}
