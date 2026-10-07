import type { SupabaseClient } from '@supabase/supabase-js'
import type { PagoNuevo } from '@/lib/repositories/interfaces'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { makePagoRepository } from '@/lib/repositories/pagoRepository'
import { createClient } from '@/lib/supabase/server'
import { gananciaCambiariaBs, saldoPendiente, usdEquivalentes } from './creditService'

/**
 * PagoService (SRP): cobros/abonos a facturas de clientes.
 * Reusa `creditService` (no reimplementa ganancia cambiaria ni conversión).
 */

export class PagoError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'PagoError'
  }
}

const TOLERANCIA_PAGO_USD = 0.01
const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6

export interface RegistrarPagoInput {
  factura_id: string
  fecha: string
  monto: number
  moneda_pago: 'usd' | 'bs'
  tasa_pago: number
  metodo: string
}

export async function registrarPago(
  input: RegistrarPagoInput,
  db?: SupabaseClient
): Promise<string> {
  const client = db ?? (await createClient())
  const factura = await makeFacturaRepository(client).getById(input.factura_id)
  if (!factura) throw new PagoError('La factura no existe')
  if (factura.estado !== 'abierta') throw new PagoError('La factura no tiene saldo pendiente')

  const saldo = saldoPendiente(Number(factura.total_usd), Number(factura.pagado_usd))
  let montoUsd = redondea6(usdEquivalentes(input.monto, input.moneda_pago, input.tasa_pago))
  if (montoUsd > saldo + TOLERANCIA_PAGO_USD) {
    throw new PagoError('El monto supera el saldo pendiente', 'monto')
  }
  montoUsd = Math.min(montoUsd, saldo)

  const pago: PagoNuevo = {
    factura_id: factura.id,
    fecha: input.fecha,
    monto_usd: montoUsd,
    moneda_pago: input.moneda_pago,
    tasa_pago: redondea6(input.tasa_pago),
    metodo: input.metodo as PagoNuevo['metodo'],
    ganancia_cambiaria_bs: redondea6(
      gananciaCambiariaBs(Number(factura.tasa_snapshot), input.tasa_pago, montoUsd, input.moneda_pago)
    ),
  }

  return makePagoRepository(client).create(pago)
}
