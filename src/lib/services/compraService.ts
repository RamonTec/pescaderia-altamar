import type { SupabaseClient } from '@supabase/supabase-js'
import type { Compra, LoteCreado, Producto } from '@/types/domain'
import type { CompraItemNuevo } from '@/lib/repositories/interfaces'
import type { CompraFormValues, PagoProveedorFormValues } from '@/lib/compraValidation'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { createClient } from '@/lib/supabase/server'
import { entradaTasaDe } from '@/lib/tasaValidation'
import { MSG_TASA_SIN_REFERENCIAL } from '@/lib/validationMessages'
import { resolverTasaOperacion, type ResultadoTasaOperacion } from './tasaService'
import { gananciaCambiariaBs, saldoPendiente, usdEquivalentes } from './creditService'

/**
 * CompraService (SRP): reglas de negocio de la recepción de mercancía y de
 * las cuentas por pagar a proveedores (/SPEC.md §4.2 y §4.5).
 *
 * Registrar una compra:
 *   1. Proveedor activo; si es a crédito, no bloqueado (03-proveedores).
 *   2. Items de productos crudos activos.
 *   3. Costo por kg convertido a USD con la tasa congelada (`tasa_snapshot`).
 *   4. Compra + items + un lote y un movimiento `compra` por item, en una
 *      transacción (RPC `registrar_compra`, 07-lotes). Devuelve los códigos
 *      de lote para rotular los recipientes.
 *   5. Contado → `pagado_usd = subtotal_usd`, estado `pagada`.
 *
 * 08-tasas: la referencial se resuelve en el servidor con
 * `resolverTasaOperacion` para la fecha de la operación (no la de hoy); la
 * operación nunca falla por falta de referencial si el usuario mandó una
 * tasa manual.
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
export function costoUsdKg(costoKg: number, moneda: 'usd' | 'bs', tasa: number): number {
  return redondea6(usdEquivalentes(costoKg, moneda, tasa))
}

export function subtotalUsd(items: Pick<CompraItemNuevo, 'peso_kg' | 'costo_usd_kg'>[]): number {
  return redondea6(items.reduce((s, i) => s + i.peso_kg * i.costo_usd_kg, 0))
}

/** Resuelve la tasa de la operación en el servidor (sin `sin_referencial`). */
type TasaResuelta = {
  tasa_operacion: NonNullable<ResultadoTasaOperacion['tasa_operacion']>
  aviso?: 'referencial_cambio'
}

/**
 * Resuelve la tasa de la operación en el servidor (08-tasas) y devuelve el
 * `TasaOperacion` completo. Los servicios que guardan tasa usan este helper
 * (SRP): mapea `sin_referencial` al error de dominio del spec.
 */
async function tasaDeOperacion(
  input: CompraFormValues | PagoProveedorFormValues,
  fecha: string,
  db: SupabaseClient
): Promise<TasaResuelta> {
  const resultado = await resolverTasaOperacion(entradaTasaDe(input), fecha, db)
  if (resultado.error === 'sin_referencial' || !resultado.tasa_operacion) {
    throw new CompraError(MSG_TASA_SIN_REFERENCIAL, 'tasa')
  }
  return { tasa_operacion: resultado.tasa_operacion, aviso: resultado.aviso }
}

export async function crearCompra(input: CompraFormValues): Promise<{
  compra_id: string
  /** Lotes creados (uno por item con control de stock), sin costos. */
  lotes: LoteCreado[]
  aviso?: 'referencial_cambio'
}> {
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

  // La referencial corresponde a la fecha de la compra (08-tasas).
  const { tasa_operacion: tasa, aviso } = await tasaDeOperacion(input, input.fecha, db)

  const items: CompraItemNuevo[] = input.items.map((i) => ({
    producto_id: i.producto_id,
    peso_kg: Math.round(i.peso_kg * 1000) / 1000,
    costo_usd_kg: costoUsdKg(i.costo_kg, input.moneda, tasa.tasa_snapshot),
  }))
  const subtotal = subtotalUsd(items)
  const contado = input.condicion === 'contado'

  const compra = {
    id: crypto.randomUUID(),
    proveedor_id: proveedor.id,
    fecha: input.fecha,
    condicion: input.condicion,
    moneda: input.moneda,
    tasa_snapshot: redondea6(tasa.tasa_snapshot),
    tasa_origen: tasa.tasa_origen,
    tasa_fuente: tasa.tasa_fuente,
    tasa_referencial: tasa.tasa_referencial,
    subtotal_usd: subtotal,
    pagado_usd: contado ? subtotal : 0,
    // Una compra a crédito sin monto (costo 0) no deja nada por pagar.
    estado: (contado || subtotal === 0 ? 'pagada' : 'abierta') as Compra['estado'],
    notas: input.notas.trim() || null,
  }

  const { compra_id, lotes } = await makeCompraRepository(db).create(compra, items)
  return { compra_id, lotes, aviso }
}

/**
 * Abono a una compra a crédito. La deuda está en USD; si se paga en Bs, el
 * monto se convierte con la tasa de la fecha del abono y se registra la
 * ganancia cambiaria respecto de la tasa congelada en la compra (§4.5), con
 * la tasa final elegida (referencial o manual).
 */
export async function registrarPagoProveedor(input: PagoProveedorFormValues): Promise<{
  pago_id: string
  aviso?: 'referencial_cambio'
}> {
  const db = await createClient()
  const repo = makeCompraRepository(db)

  const compra = await repo.getById(input.compra_id)
  if (!compra) throw new CompraError('La compra no existe')
  if (compra.estado !== 'abierta') {
    throw new CompraError('La compra no tiene saldo pendiente')
  }

  // La referencial corresponde a la fecha del abono (08-tasas).
  const { tasa_operacion: tasa, aviso } = await tasaDeOperacion(input, input.fecha, db)
  const tasaPago = tasa.tasa_snapshot

  const saldo = saldoPendiente(Number(compra.subtotal_usd), Number(compra.pagado_usd))
  let montoUsd = redondea6(usdEquivalentes(input.monto, input.moneda_pago, tasaPago))
  if (montoUsd > saldo + TOLERANCIA_PAGO_USD) {
    throw new CompraError('El monto supera el saldo pendiente', 'monto')
  }
  montoUsd = Math.min(montoUsd, saldo)

  return repo
    .registrarPago({
      compra_id: compra.id,
      fecha: input.fecha,
      monto_usd: montoUsd,
      moneda_pago: input.moneda_pago,
      tasa_pago: redondea6(tasaPago),
      metodo: input.metodo,
      ganancia_cambiaria_bs: redondea6(
        gananciaCambiariaBs(Number(compra.tasa_snapshot), tasaPago, montoUsd, input.moneda_pago)
      ),
      tasa_origen: tasa.tasa_origen,
      tasa_fuente: tasa.tasa_fuente,
      tasa_referencial: tasa.tasa_referencial,
    })
    .then((pago_id) => ({ pago_id, aviso }))
}