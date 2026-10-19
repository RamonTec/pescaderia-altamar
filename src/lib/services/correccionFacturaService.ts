import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResultadoCorreccion } from '@/types/domain'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { createClient } from '@/lib/supabase/server'
import { corregirLineaSchema } from '@/lib/correccionFacturaValidation'
import { previsualizarCorreccion } from '@/lib/facturas/correccion'
import { requireAdmin } from './authService'
import { getSaldoPendiente } from './clienteBalanceService'
import { LimiteCreditoExcedido } from './invoiceService'

/**
 * CorreccionFacturaService (17): corrige el peso y/o el precio/kg de una
 * línea de factura. Solo admin. Único que usa `IFacturaRepository.corregirLinea`.
 *
 *   1. Exige admin y valida con `corregirLineaSchema`.
 *   2. Factura a crédito cuyo saldo sube: si el saldo del cliente más el
 *      aumento supera su límite, lanza `LimiteCreditoExcedido` (aviso blando
 *      de 05 §4.1) salvo `forzar_limite`. El bloqueo del cliente no impide
 *      corregir: no es una venta nueva.
 *   3. Llama a la RPC (atómica, con lock) y traduce sus `hint` a campos.
 */

export type CampoCorreccion = 'peso_kg' | 'precio_usd_kg' | 'motivo'

export class CorreccionFacturaError extends Error {
  constructor(
    message: string,
    readonly campo?: CampoCorreccion
  ) {
    super(message)
    this.name = 'CorreccionFacturaError'
  }
}

const MSG_SOLO_ADMIN = 'Solo un administrador puede corregir facturas'

/** `hint` de `corregir_linea_factura` → campo del formulario; el resto va al `Alert`. */
const CAMPO_DE_HINT: Record<string, CampoCorreccion> = {
  peso_menor_devuelto: 'peso_kg',
  stock_insuficiente: 'peso_kg',
  linea_sin_lotes: 'peso_kg',
  peso_invalido: 'peso_kg',
  precio_invalido: 'precio_usd_kg',
  motivo_requerido: 'motivo',
}

/** Error de la RPC → `CorreccionFacturaError` con su campo, o el error tal cual. */
export function errorDeCorreccion(e: unknown): unknown {
  const pg = (e ?? {}) as { code?: string; hint?: string; message?: string }
  if (pg.code === '42501') return new CorreccionFacturaError(MSG_SOLO_ADMIN)
  if (pg.code === 'P0001' && pg.message) {
    return new CorreccionFacturaError(pg.message, pg.hint ? CAMPO_DE_HINT[pg.hint] : undefined)
  }
  return e
}

const redondea2 = (n: number) => Math.round(n * 100) / 100

export async function corregirLinea(input: unknown, db?: SupabaseClient): Promise<ResultadoCorreccion> {
  if (!(await requireAdmin())) throw new CorreccionFacturaError(MSG_SOLO_ADMIN)

  const safe = corregirLineaSchema.safeParse(input)
  if (!safe.success) {
    const issue = safe.error.issues[0]
    const campo = issue?.path[0]
    throw new CorreccionFacturaError(
      issue?.message ?? 'Datos inválidos',
      campo === 'peso_kg' || campo === 'precio_usd_kg' || campo === 'motivo' ? campo : undefined
    )
  }
  const v = safe.data

  const client = db ?? (await createClient())
  const repo = makeFacturaRepository(client)

  const traza = await repo.getTrazabilidad(v.factura_id)
  const linea = traza?.lineas.find((l) => l.id === v.factura_item_id)
  if (!traza || !linea) throw new CorreccionFacturaError('La línea no pertenece a la factura')

  // Aviso blando de límite de crédito (solo crédito, solo si el saldo sube).
  const { factura } = traza
  const limite = factura.cliente.limite_credito_usd
  if (factura.condicion === 'credito' && factura.estado !== 'anulada' && !v.forzar_limite && limite != null && limite > 0) {
    const creditos = traza.notas_credito
      .filter((n) => n.estado === 'emitida')
      .reduce((s, n) => s + n.total_usd, 0)
    const vista = previsualizarCorreccion(
      { ...factura, creditos_usd: creditos, lineas: traza.lineas },
      v.factura_item_id,
      v.peso_kg,
      v.precio_usd_kg
    )
    const aumento = vista.saldo_despues_usd - vista.saldo_antes_usd
    if (aumento > 0) {
      const saldo = await getSaldoPendiente(factura.cliente.id, client)
      if (saldo + aumento > limite) {
        throw new LimiteCreditoExcedido({
          limite_usd: limite,
          saldo_actual_usd: redondea2(saldo),
          nuevo_total_usd: redondea2(aumento),
          excedente_usd: redondea2(saldo + aumento - limite),
        })
      }
    }
  }

  try {
    return await repo.corregirLinea({
      factura_item_id: v.factura_item_id,
      peso_kg: v.peso_kg,
      precio_usd_kg: v.precio_usd_kg,
      motivo: v.motivo,
    })
  } catch (e) {
    throw errorDeCorreccion(e)
  }
}
