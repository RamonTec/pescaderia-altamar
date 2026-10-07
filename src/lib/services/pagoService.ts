import type { SupabaseClient } from '@supabase/supabase-js'
import type { PagoNuevo } from '@/lib/repositories/interfaces'
import type { PagoFormValues } from '@/lib/pagoValidation'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { makePagoRepository } from '@/lib/repositories/pagoRepository'
import { createClient } from '@/lib/supabase/server'
import { entradaTasaDe } from '@/lib/tasaValidation'
import { MSG_TASA_SIN_REFERENCIAL } from '@/lib/validationMessages'
import { resolverTasaOperacion } from './tasaService'
import { gananciaCambiariaBs, saldoPendiente, usdEquivalentes } from './creditService'

/**
 * PagoService (SRP): cobros/abonos a facturas de clientes.
 * Reusa `creditService` (no reimplementa ganancia cambiaria ni conversión).
 *
 * 08-tasas: la referencial del abono se resuelve en el servidor con
 * `resolverTasaOperacion` para la **fecha del abono**; la ganancia cambiaria
 * (§4.5) usa la tasa final elegida (referencial o manual).
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

export async function registrarPago(
  input: PagoFormValues,
  db?: SupabaseClient
): Promise<{ pago_id: string; aviso?: 'referencial_cambio' }> {
  const client = db ?? (await createClient())
  const factura = await makeFacturaRepository(client).getById(input.factura_id)
  if (!factura) throw new PagoError('La factura no existe')
  if (factura.estado !== 'abierta') throw new PagoError('La factura no tiene saldo pendiente')

  const resultado = await resolverTasaOperacion(entradaTasaDe(input), input.fecha, client)
  if (resultado.error === 'sin_referencial' || !resultado.tasa_operacion) {
    throw new PagoError(MSG_TASA_SIN_REFERENCIAL, 'tasa')
  }
  const tasa = resultado.tasa_operacion
  const tasaPago = tasa.tasa_snapshot

  const saldo = saldoPendiente(Number(factura.total_usd), Number(factura.pagado_usd))
  let montoUsd = redondea6(usdEquivalentes(input.monto, input.moneda_pago, tasaPago))
  if (montoUsd > saldo + TOLERANCIA_PAGO_USD) {
    throw new PagoError('El monto supera el saldo pendiente', 'monto')
  }
  montoUsd = Math.min(montoUsd, saldo)

  const pago: PagoNuevo = {
    factura_id: factura.id,
    fecha: input.fecha,
    monto_usd: montoUsd,
    moneda_pago: input.moneda_pago,
    tasa_pago: redondea6(tasaPago),
    metodo: input.metodo,
    ganancia_cambiaria_bs: redondea6(
      gananciaCambiariaBs(Number(factura.tasa_snapshot), tasaPago, montoUsd, input.moneda_pago)
    ),
    tasa_origen: tasa.tasa_origen,
    tasa_fuente: tasa.tasa_fuente,
    tasa_referencial: tasa.tasa_referencial,
  }

  const pagoId = await makePagoRepository(client).create(pago)
  return { pago_id: pagoId, aviso: resultado.aviso }
}