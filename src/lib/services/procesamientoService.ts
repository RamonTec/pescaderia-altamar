import type { Procesamiento, Producto } from '@/types/domain'
import type { ProcesamientoRegistrado } from '@/lib/repositories/interfaces'
import type { ProcesamientoFormValues } from '@/lib/procesamientoValidation'
import { TOLERANCIA_KG } from '@/lib/loteValidation'
import { makeProcesamientoRepository } from '@/lib/repositories/procesamientoRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { makeLoteRepository } from '@/lib/repositories/loteRepository'
import { createClient } from '@/lib/supabase/server'
import { formatKg } from '@/lib/format'

/**
 * ProcesamientoService (SRP): limpieza de producto crudo por lote
 * (/SPEC.md §4.3, 07-lotes).
 *
 *   1. Origen crudo activo, destino procesado activo que se obtiene de ese
 *      crudo (`productos.producto_origen_id`, 0014), salida ≤ entrada.
 *   2. Lote de origen elegido por el operador: del crudo, abierto y con
 *      stock suficiente (aviso temprano; la base lo revalida bajo lock de la
 *      fila del lote).
 *   3. Procesamiento + línea + lote procesado (ligado a su padre) +
 *      movimientos `proceso_out`/`proceso_in` en una transacción (RPC
 *      `registrar_procesamiento`). Un lote crudo da un lote procesado.
 *
 * El costo transferido lo aplica la RPC con el costo del lote: el operador
 * no puede leer costos, así que el servicio no lo conoce cuando corre con su
 * sesión. En la UI, `costoDestino` se usa para merma, rendimiento y (solo
 * admin) el costo resultante.
 */

export class ProcesamientoError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'ProcesamientoError'
  }
}

const redondeaKg = (n: number) => Math.round(n * 1000) / 1000

export async function crearProcesamiento(
  input: ProcesamientoFormValues
): Promise<ProcesamientoRegistrado> {
  const db = await createClient()

  const [productosLista, lote] = await Promise.all([
    makeProductoRepository(db).list(),
    makeLoteRepository(db).getById(input.lote_origen_id),
  ])
  const productos = new Map(productosLista.map((p): [string, Producto] => [p.id, p]))
  const origen = productos.get(input.producto_origen_id)
  const destino = productos.get(input.producto_destino_id)

  if (!origen || !origen.activo) {
    throw new ProcesamientoError('Producto no disponible', 'producto_origen_id')
  }
  if (origen.tipo !== 'crudo') {
    throw new ProcesamientoError(`${origen.nombre} no es un producto crudo`, 'producto_origen_id')
  }
  if (!origen.controla_stock) {
    throw new ProcesamientoError(
      `${origen.nombre} no controla stock: no tiene lotes para procesar`,
      'producto_origen_id'
    )
  }
  if (!destino || !destino.activo) {
    throw new ProcesamientoError('Producto no disponible', 'producto_destino_id')
  }
  if (destino.tipo !== 'procesado') {
    throw new ProcesamientoError(
      `${destino.nombre} no es un producto procesado`,
      'producto_destino_id'
    )
  }
  if (destino.producto_origen_id !== origen.id) {
    throw new ProcesamientoError(
      `${destino.nombre} no se obtiene de ${origen.nombre}`,
      'producto_destino_id'
    )
  }

  if (!lote || lote.producto_id !== origen.id) {
    throw new ProcesamientoError(`Elige un lote de ${origen.nombre}`, 'lote_origen_id')
  }
  if (lote.estado !== 'abierto') {
    throw new ProcesamientoError(`El lote ${lote.codigo} no está abierto`, 'lote_origen_id')
  }

  const pesoEntrada = redondeaKg(input.peso_entrada_kg)
  const pesoSalida = redondeaKg(input.peso_salida_kg)
  if (pesoSalida > pesoEntrada) {
    throw new ProcesamientoError(
      'El peso de salida no puede superar al de entrada',
      'peso_salida_kg'
    )
  }
  if (pesoEntrada > lote.stock_kg + TOLERANCIA_KG) {
    throw new ProcesamientoError(
      `El lote ${lote.codigo} solo tiene ${formatKg(lote.stock_kg)}`,
      'peso_entrada_kg'
    )
  }

  const procesamiento: Procesamiento = {
    id: crypto.randomUUID(),
    fecha: input.fecha,
    notas: input.notas.trim() || null,
  }

  return makeProcesamientoRepository(db).create(procesamiento, [
    {
      lote_origen_id: lote.id,
      producto_origen_id: origen.id,
      peso_entrada_kg: pesoEntrada,
      producto_destino_id: destino.id,
      peso_salida_kg: pesoSalida,
    },
  ])
}
