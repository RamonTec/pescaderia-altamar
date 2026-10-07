import type { Procesamiento, Producto } from '@/types/domain'
import type { ProcesamientoFormValues } from '@/lib/procesamientoValidation'
import { makeProcesamientoRepository } from '@/lib/repositories/procesamientoRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { createClient } from '@/lib/supabase/server'
import { getStocks } from './costingService'

/**
 * ProcesamientoService (SRP): limpieza de producto crudo (/SPEC.md §4.3).
 *
 *   1. Origen crudo activo, destino procesado activo que se obtiene de ese
 *      crudo (`productos.producto_origen_id`, 0014), salida ≤ entrada.
 *   2. Stock suficiente del origen (aviso temprano; la base lo revalida con lock).
 *   3. Procesamiento + lote + movimientos `proceso_out`/`proceso_in` en una
 *      transacción (RPC `registrar_procesamiento`, 0013).
 *
 * El costo transferido (`costoDestino`) lo aplica la RPC con el costo promedio
 * vigente del origen: el operador no puede leer costos (0003), así que el
 * servicio no lo conoce cuando corre con su sesión. En la UI, `costoDestino`
 * se usa para mostrar merma, rendimiento y (solo admin) el costo resultante.
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

/** Tolerancia de redondeo de numeric(12,3), la misma que usa la RPC. */
const TOLERANCIA_KG = 0.0005

const redondeaKg = (n: number) => Math.round(n * 1000) / 1000

export async function crearProcesamiento(input: ProcesamientoFormValues): Promise<string> {
  const db = await createClient()

  const productos = new Map(
    (await makeProductoRepository(db).list()).map((p): [string, Producto] => [p.id, p])
  )
  const origen = productos.get(input.producto_origen_id)
  const destino = productos.get(input.producto_destino_id)

  if (!origen || !origen.activo) {
    throw new ProcesamientoError('Producto no disponible', 'producto_origen_id')
  }
  if (origen.tipo !== 'crudo') {
    throw new ProcesamientoError(`${origen.nombre} no es un producto crudo`, 'producto_origen_id')
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

  const pesoEntrada = redondeaKg(input.peso_entrada_kg)
  const pesoSalida = redondeaKg(input.peso_salida_kg)
  if (pesoSalida > pesoEntrada) {
    throw new ProcesamientoError(
      'El peso de salida no puede superar al de entrada',
      'peso_salida_kg'
    )
  }

  if (origen.controla_stock) {
    const stock = (await getStocks(db)).get(origen.id)?.stock_kg ?? 0
    if (pesoEntrada > stock + TOLERANCIA_KG) {
      throw new ProcesamientoError(
        `Solo hay ${stock.toFixed(3)} kg de ${origen.nombre} en stock`,
        'peso_entrada_kg'
      )
    }
  }

  const procesamiento: Procesamiento = {
    id: crypto.randomUUID(),
    fecha: input.fecha,
    notas: input.notas.trim() || null,
  }

  return makeProcesamientoRepository(db).create(procesamiento, [
    {
      producto_origen_id: origen.id,
      peso_entrada_kg: pesoEntrada,
      producto_destino_id: destino.id,
      peso_salida_kg: pesoSalida,
    },
  ])
}
