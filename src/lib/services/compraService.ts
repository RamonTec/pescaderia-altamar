import type { SupabaseClient } from '@supabase/supabase-js'
import type { Compra, FuenteTasa, Producto } from '@/types/domain'
import type { CompraItemNuevo } from '@/lib/repositories/interfaces'
import type { CompraFormValues, PagoProveedorFormValues } from '@/lib/compraValidation'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { createClient } from '@/lib/supabase/server'
import { crearMovimiento } from './movimientoService'
import { fetchTasaRemota, getTasaViva } from './rateService'
import { gananciaCambiariaBs, saldoPendiente, usdEquivalentes } from './creditService'

/**
 * CompraService (SRP): reglas de negocio de la recepción de mercancía y de
 * las cuentas por pagar a proveedores (/SPEC.md §4.2 y §4.5).
 *
 * Registrar una compra:
 *   1. Proveedor activo; si es a crédito, no bloqueado (03-proveedores).
 *   2. Items de productos crudos activos.
 *   3. Costo por kg convertido a USD con la tasa congelada (`tasa_snapshot`).
 *   4. Compra + items + un movimiento `compra` por item, en una transacción.
 *   5. Contado → `pagado_usd = subtotal_usd`, estado `pagada`.
 */

/** Error de regla de negocio; `campo` permite marcarlo en el formulario. */
export class CompraError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'CompraError'
  }
}

/** Tolerancia al convertir un abono en Bs a USD (redondeo de la tasa). */
const TOLERANCIA_PAGO_USD = 0.01

const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Costo/kg en USD a partir del costo en la moneda de la compra. */
export function costoUsdKg(costoKg: number, moneda: Compra['moneda'], tasa: number): number {
  return redondea6(usdEquivalentes(costoKg, moneda, tasa))
}

export function subtotalUsd(items: Pick<CompraItemNuevo, 'peso_kg' | 'costo_usd_kg'>[]): number {
  return redondea6(items.reduce((s, i) => s + i.peso_kg * i.costo_usd_kg, 0))
}

export interface TasaSugerida {
  bs_por_usd: number
  fuente: FuenteTasa
}

/**
 * Tasa del día según la fuente preferida de `config_negocio`: primero la
 * registrada en `tasas` (incluida una manual de hoy), si no la de la API.
 * `null` si no hay ninguna: la UI pide cargarla a mano.
 */
export async function getTasaSugerida(db?: SupabaseClient): Promise<TasaSugerida | null> {
  const client = db ?? (await createClient())
  const config = await makeConfigNegocioRepository(client).get()
  const fuente = config?.fuente_tasa_default ?? 'bcv'

  const registrada = await getTasaViva(fuente, client)
  if (registrada) return { bs_por_usd: Number(registrada.bs_por_usd), fuente: registrada.fuente }

  const remota = await fetchTasaRemota(fuente)
  return remota ? { bs_por_usd: remota, fuente } : null
}

export async function crearCompra(input: CompraFormValues): Promise<string> {
  const db = await createClient()

  const proveedor = await makeProveedorRepository(db).getById(input.proveedor_id)
  if (!proveedor) throw new CompraError('El proveedor no existe', 'proveedor_id')
  if (!proveedor.activo) {
    throw new CompraError('El proveedor está inactivo', 'proveedor_id')
  }
  if (input.condicion === 'credito' && proveedor.bloqueado) {
    throw new CompraError(
      `${proveedor.nombre} está bloqueado: no se permiten compras a crédito`,
      'condicion'
    )
  }

  const productos = new Map(
    (await makeProductoRepository(db).list()).map((p): [string, Producto] => [p.id, p])
  )
  input.items.forEach((item, index) => {
    const p = productos.get(item.producto_id)
    const campo = `items.${index}.producto_id`
    if (!p || !p.activo) throw new CompraError('Producto no disponible', campo)
    if (p.tipo !== 'crudo') {
      throw new CompraError(`${p.nombre} es procesado: las compras son de producto crudo`, campo)
    }
  })

  const items: CompraItemNuevo[] = input.items.map((i) => ({
    producto_id: i.producto_id,
    peso_kg: Math.round(i.peso_kg * 1000) / 1000,
    costo_usd_kg: costoUsdKg(i.costo_kg, input.moneda, input.tasa),
  }))
  const subtotal = subtotalUsd(items)
  const contado = input.condicion === 'contado'

  const compra: Compra = {
    id: crypto.randomUUID(),
    proveedor_id: proveedor.id,
    fecha: input.fecha,
    condicion: input.condicion,
    moneda: input.moneda,
    tasa_snapshot: redondea6(input.tasa),
    subtotal_usd: subtotal,
    pagado_usd: contado ? subtotal : 0,
    // Una compra a crédito sin monto (costo 0) no deja nada por pagar.
    estado: contado || subtotal === 0 ? 'pagada' : 'abierta',
    notas: input.notas.trim() || null,
  }

  const movimientos = items.map((i) =>
    crearMovimiento('compra', i.producto_id, i.peso_kg, i.costo_usd_kg, compra.id)
  )

  return makeCompraRepository(db).create(compra, items, movimientos)
}

/**
 * Abono a una compra a crédito. La deuda está en USD; si se paga en Bs, el
 * monto se convierte con la tasa del día del pago y se registra la ganancia
 * cambiaria respecto de la tasa congelada en la compra.
 */
export async function registrarPagoProveedor(input: PagoProveedorFormValues): Promise<string> {
  const db = await createClient()
  const repo = makeCompraRepository(db)

  const compra = await repo.getById(input.compra_id)
  if (!compra) throw new CompraError('La compra no existe')
  if (compra.estado !== 'abierta') {
    throw new CompraError('La compra no tiene saldo pendiente')
  }

  const saldo = saldoPendiente(Number(compra.subtotal_usd), Number(compra.pagado_usd))
  let montoUsd = redondea6(usdEquivalentes(input.monto, input.moneda_pago, input.tasa_pago))
  if (montoUsd > saldo + TOLERANCIA_PAGO_USD) {
    throw new CompraError('El monto supera el saldo pendiente', 'monto')
  }
  montoUsd = Math.min(montoUsd, saldo)

  return repo.registrarPago({
    compra_id: compra.id,
    fecha: input.fecha,
    monto_usd: montoUsd,
    moneda_pago: input.moneda_pago,
    tasa_pago: redondea6(input.tasa_pago),
    metodo: input.metodo,
    ganancia_cambiaria_bs: redondea6(
      gananciaCambiariaBs(Number(compra.tasa_snapshot), input.tasa_pago, montoUsd, input.moneda_pago)
    ),
  })
}
