import type { SupabaseClient } from '@supabase/supabase-js'
import type { Cliente, CondicionPago, Factura } from '@/types/domain'
import type { FacturaItemNuevo, FacturaNueva } from '@/lib/repositories/interfaces'
import type { EntradaTasaOperacion } from './tasaService'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { createClient } from '@/lib/supabase/server'
import { MSG_TASA_SIN_REFERENCIAL } from '@/lib/validationMessages'
import { crearMovimiento } from './movimientoService'
import { getCostosPorProducto } from './costingService'
import { resolverTasaOperacion } from './tasaService'
import { getSaldoPendiente } from './clienteBalanceService'

/**
 * InvoiceService (SRP): emisión de facturas internas con IVA desglosado y
 * snapshot de tasa y costo (/SPEC.md §4.4 y §4.6).
 *
 * Responsabilidades:
 *   - Validar cliente activo y, para crédito, no bloqueado (bloqueo duro).
 *   - Obtener `iva_pct` de `config_negocio`.
 *   - Snapshot de costo promedio por producto (`getCostosPorProducto`).
 *   - Calcular subtotal/IVA/total.
 *   - Verificar el límite de crédito del cliente contra su saldo pendiente.
 *   - Delegar la escritura atómica (factura + items + movimientos `venta`)
 *     al repositorio/RPC.
 *
 * 08-tasas: la tasa la elige el usuario (referencial o manual) y se resuelve
 * en el servidor con `resolverTasaOperacion` para la fecha de la factura.
 * Sin referencial disponible y sin tasa manual, falla con el mensaje claro
 * del spec (corrige "No hay tasa registrada hoy").
 */

export class InvoiceError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'InvoiceError'
  }
}

/** Advertencia de límite de crédito: no es error, la UI decide si forzar. */
export interface AdvertenciaLimiteCredito {
  limite_usd: number
  saldo_actual_usd: number
  nuevo_total_usd: number
  excedente_usd: number
}

/** La venta a crédito excede el límite del cliente: la UI pide confirmación. */
export class LimiteCreditoExcedido extends Error {
  constructor(readonly advertencia: AdvertenciaLimiteCredito) {
    super('La venta a crédito excede el límite de crédito del cliente')
    this.name = 'LimiteCreditoExcedido'
  }
}

const redondea2 = (n: number) => Math.round(n * 100) / 100
const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6

export interface ItemFacturaInput {
  producto_id: string
  peso_kg: number
  precio_usd_kg: number
}

export interface CrearFacturaInput {
  cliente_id: string
  pedido_id?: string
  items: ItemFacturaInput[]
  condicion: CondicionPago
  fecha?: string
  /** Confirmación explícita de la UI cuando excede el límite de crédito. */
  forzar_limite?: boolean
  pesos_reales?: { pedido_item_id: string; peso_kg: number }[]
  /**
   * Días de crédito de esta factura (09-cuentas-por-cobrar). Sin valor, los
   * del cliente o el default del negocio; en contado se fuerza 0.
   */
  dias_credito?: number | null
  /**
   * Tasa elegida para esta factura (08-tasas): referencial (el servidor
   * recalculará el valor vigente) o manual (> 0).
   */
  tasa: EntradaTasaOperacion
}

export interface CrearFacturaResultado {
  factura_id: string
  numero?: number
  advertencia: AdvertenciaLimiteCredito | null
  /** La referencial vigente del servidor es otra que la que vio el cliente. */
  aviso?: 'referencial_cambio'
}

export const DIAS_CREDITO_DEFAULT = 15
export const DIAS_CREDITO_MAX = 365

/**
 * Días de crédito de una factura: contado = 0; crédito = los indicados al
 * emitir, o los habituales del cliente, o el default del negocio.
 */
export function resolverDiasCredito(
  condicion: CondicionPago,
  indicados: number | null | undefined,
  cliente: Pick<Cliente, 'dias_credito'>,
  defaultNegocio: number | null | undefined
): number {
  if (condicion === 'contado') return 0
  const dias = indicados ?? cliente.dias_credito ?? defaultNegocio ?? DIAS_CREDITO_DEFAULT
  if (!Number.isInteger(dias) || dias < 0 || dias > DIAS_CREDITO_MAX) {
    throw new InvoiceError(
      `Los días de crédito deben ser un entero entre 0 y ${DIAS_CREDITO_MAX}`,
      'dias_credito'
    )
  }
  return dias
}

export function subtotalItems(items: ItemFacturaInput[]): number {
  return redondea6(items.reduce((s, i) => s + i.peso_kg * i.precio_usd_kg, 0))
}

export function ivaSobre(subtotal: number, ivaPct: number): number {
  return redondea6(subtotal * (ivaPct / 100))
}

/**
 * Verifica el límite de crédito: saldo pendiente actual + nuevo total vs
 * `limite_credito_usd`. Devuelve la advertencia (o `null`) para que la UI
 * decida pedir confirmación; el servicio no fuerza nada aquí.
 */
export async function verificarLimiteCredito(
  cliente: Cliente,
  nuevoTotalUsd: number,
  client: SupabaseClient
): Promise<AdvertenciaLimiteCredito | null> {
  if (cliente.limite_credito_usd == null || cliente.limite_credito_usd <= 0) return null
  const saldo = await getSaldoPendiente(cliente.id, client)
  const total = saldo + nuevoTotalUsd
  if (total <= cliente.limite_credito_usd) return null
  return {
    limite_usd: cliente.limite_credito_usd,
    saldo_actual_usd: redondea2(saldo),
    nuevo_total_usd: redondea2(nuevoTotalUsd),
    excedente_usd: redondea2(total - cliente.limite_credito_usd),
  }
}

export async function crearFactura(
  input: CrearFacturaInput,
  db?: SupabaseClient
): Promise<CrearFacturaResultado> {
  const client = db ?? (await createClient())
  const clienteRepo = makeClienteRepository(client)

  // Lecturas paralelas: cliente, config (IVA + fuente de tasa) y productos
  // evitan 2 round-trips secuenciales contra el proyecto remoto.
  const [cliente, config, productos] = await Promise.all([
    clienteRepo.getById(input.cliente_id),
    makeConfigNegocioRepository(client).get(),
    makeProductoRepository(client).list(),
  ])

  if (!cliente) throw new InvoiceError('El cliente no existe', 'cliente_id')
  if (!cliente.activo) throw new InvoiceError('El cliente está inactivo', 'cliente_id')

  if (input.condicion === 'credito' && cliente.bloqueado) {
    throw new InvoiceError(
      `${cliente.nombre} está bloqueado: no se permiten ventas a crédito`,
      'condicion'
    )
  }

  if (input.items.length === 0) {
    throw new InvoiceError('Agrega al menos un producto', 'items')
  }

  const ivaPct = Number(config?.iva_pct ?? 16)

  const productosMap = new Map(productos.map((p) => [p.id, p]))
  for (let index = 0; index < input.items.length; index++) {
    const it = input.items[index]
    const p = productosMap.get(it.producto_id)
    if (!p || !p.activo) throw new InvoiceError('Producto no disponible', `items.${index}.producto_id`)
    if (it.peso_kg <= 0) throw new InvoiceError('El peso debe ser mayor a 0', `items.${index}.peso_kg`)
  }

  const fecha = input.fecha ?? new Date().toISOString().slice(0, 10)
  const diasCredito = resolverDiasCredito(
    input.condicion,
    input.dias_credito,
    cliente,
    config?.dias_credito_default
  )

  // Tasa y costos en paralelo: una sola query de movimientos para todos los
  // items (antes, un round-trip por producto).
  const [resultado, costos] = await Promise.all([
    resolverTasaOperacion(
      input.tasa,
      fecha,
      client,
      config?.fuente_tasa_default
    ),
    getCostosPorProducto(
      input.items.map((i) => i.producto_id),
      client
    ),
  ])
  if (resultado.error === 'sin_referencial' || !resultado.tasa_operacion) {
    throw new InvoiceError(MSG_TASA_SIN_REFERENCIAL, 'tasa')
  }
  const tasaOperacion = resultado.tasa_operacion

  const items: FacturaItemNuevo[] = input.items.map((it) => ({
    producto_id: it.producto_id,
    peso_kg: redondea6(it.peso_kg),
    precio_usd_kg: redondea6(it.precio_usd_kg),
    costo_usd_kg: redondea6(costos.get(it.producto_id) ?? 0),
  }))

  const subtotal = subtotalItems(input.items)
  const iva = ivaSobre(subtotal, ivaPct)
  const total = redondea6(subtotal + iva)
  const contado = input.condicion === 'contado'

  const factura: FacturaNueva = {
    id: crypto.randomUUID(),
    cliente_id: cliente.id,
    fecha,
    condicion: input.condicion,
    dias_credito: diasCredito,
    tasa_snapshot: redondea6(tasaOperacion.tasa_snapshot),
    iva_pct: ivaPct,
    subtotal_usd: subtotal,
    iva_usd: iva,
    total_usd: total,
    pagado_usd: contado ? total : 0,
    estado: contado ? 'pagada' : 'abierta',
    tasa_origen: tasaOperacion.tasa_origen,
    tasa_fuente: tasaOperacion.tasa_fuente,
    tasa_referencial: tasaOperacion.tasa_referencial,
  }

  const movimientos = items.map((i) =>
    crearMovimiento('venta', i.producto_id, i.peso_kg, i.costo_usd_kg, factura.id)
  )

  // Soft-warning de límite de crédito: si la venta es a crédito y excede el
  // límite, se lanza `LimiteCreditoExcedido` ANTES de escribir, para que la UI
  // confirme y reintente con `forzar_limite = true`.
  if (input.condicion === 'credito' && !input.forzar_limite) {
    const advertencia = await verificarLimiteCredito(cliente, total, client)
    if (advertencia) throw new LimiteCreditoExcedido(advertencia)
  }

  const facturaId = await makeFacturaRepository(client).create(
    factura,
    items,
    movimientos,
    input.pedido_id,
    input.pesos_reales
  )

  return { factura_id: facturaId, advertencia: null, aviso: resultado.aviso }
}

export type { Factura }
