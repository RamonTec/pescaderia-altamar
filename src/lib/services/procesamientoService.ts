import type { Producto } from '@/types/domain'
import type {
  ProcesamientoNuevo,
  ProcesamientoRegistrado,
  SalidaProcesoNueva,
} from '@/lib/repositories/interfaces'
import {
  sumaSalidasKg,
  validarPreciosSalidas,
  type ProcesamientoFormValues,
} from '@/lib/procesamientoValidation'
import { TOLERANCIA_KG } from '@/lib/loteValidation'
import { makeProcesamientoRepository } from '@/lib/repositories/procesamientoRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { makeLoteRepository } from '@/lib/repositories/loteRepository'
import { createClient } from '@/lib/supabase/server'
import { formatKg } from '@/lib/format'

/**
 * ProcesamientoService (SRP): limpieza de un lote crudo con N salidas
 * (/SPEC.md §4.3, 07-lotes, 16).
 *
 *   1. Origen crudo activo con control de stock; lote del crudo, abierto y
 *      con stock suficiente (aviso temprano: la base lo revalida bajo lock
 *      de la fila del lote).
 *   2. Cada salida: procesado activo que se obtiene de ese crudo
 *      (`productos.producto_origen_id`), sin repetir producto. Σ salidas ≤
 *      entrada. Con ≥ 2 salidas, toda salida con precio de referencia (del
 *      catálogo o del formulario).
 *   3. RPC `registrar_procesamiento`: cabecera + N líneas + un `proceso_out`
 *      + un lote hijo y su `proceso_in` por salida, con el costo del lote
 *      repartido por valor de venta en la base.
 *
 * El costo lo aplica la RPC: el operador no puede leer costos, así que el
 * servicio no lo conoce cuando corre con su sesión.
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
const redondeaPrecio = (n: number) => Math.round(n * 1e6) / 1e6

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

  if (!lote || lote.producto_id !== origen.id) {
    throw new ProcesamientoError(`Elige un lote de ${origen.nombre}`, 'lote_origen_id')
  }
  if (lote.estado !== 'abierto') {
    throw new ProcesamientoError(`El lote ${lote.codigo} no está abierto`, 'lote_origen_id')
  }

  const pesoEntrada = redondeaKg(input.peso_entrada_kg)
  if (pesoEntrada > lote.stock_kg + TOLERANCIA_KG) {
    throw new ProcesamientoError(
      `El lote ${lote.codigo} solo tiene ${formatKg(lote.stock_kg)}`,
      'peso_entrada_kg'
    )
  }

  const vistos = new Set<string>()
  input.salidas.forEach((s, i) => {
    const destino = productos.get(s.producto_destino_id)
    const campo = `salidas.${i}.producto_destino_id`
    if (!destino || !destino.activo) {
      throw new ProcesamientoError('Producto no disponible', campo)
    }
    if (destino.tipo !== 'procesado') {
      throw new ProcesamientoError(`${destino.nombre} no es un producto procesado`, campo)
    }
    if (destino.producto_origen_id !== origen.id) {
      throw new ProcesamientoError(`${destino.nombre} no se obtiene de ${origen.nombre}`, campo)
    }
    if (vistos.has(destino.id)) {
      throw new ProcesamientoError(`${destino.nombre} ya está en otra salida`, campo)
    }
    vistos.add(destino.id)
  })

  const salidas: SalidaProcesoNueva[] = input.salidas.map((s) => ({
    producto_destino_id: s.producto_destino_id,
    peso_salida_kg: redondeaKg(s.peso_salida_kg),
    precio_referencia_usd_kg:
      s.precio_referencia_usd_kg == null ? null : redondeaPrecio(s.precio_referencia_usd_kg),
  }))

  if (sumaSalidasKg(salidas) > pesoEntrada + TOLERANCIA_KG) {
    throw new ProcesamientoError(
      'La suma de las salidas no puede superar el peso de entrada',
      'salidas'
    )
  }

  const erroresPrecio = validarPreciosSalidas(salidas, productosLista)
  const primero = Object.entries(erroresPrecio)[0]
  if (primero) {
    throw new ProcesamientoError(primero[1], `salidas.${primero[0]}.precio_referencia_usd_kg`)
  }

  const procesamiento: ProcesamientoNuevo = {
    id: crypto.randomUUID(),
    fecha: input.fecha,
    notas: input.notas.trim() || null,
    lote_origen_id: lote.id,
    peso_entrada_kg: pesoEntrada,
  }

  try {
    return await makeProcesamientoRepository(db).create(procesamiento, salidas)
  } catch (e) {
    // La base repite las reglas bajo lock (stock, duplicados, precios):
    // su error marca la fila del formulario (`salidas.N.*`).
    const mapeado = campoDeErrorProcesamiento(e)
    if (mapeado) throw new ProcesamientoError(mapeado.mensaje, mapeado.campo)
    throw e
  }
}

/** Error de la RPC (`PostgrestError`): código, `hint` y `detail`. */
interface PostgresErrorLike {
  code?: string
  hint?: string
  message?: string
  details?: string
  detail?: string
}

/**
 * Traduce un error de `registrar_procesamiento` al campo del formulario
 * (`salidas.N.*` con `detail = 'salida:N'`). `null` si no es de dominio.
 */
export function campoDeErrorProcesamiento(
  e: unknown
): { mensaje: string; campo: string } | null {
  const pg = (e ?? {}) as PostgresErrorLike
  if (!pg.message) return null
  const detalle = pg.details ?? pg.detail ?? ''
  const indice = /^salida:(\d+)$/.exec(detalle)?.[1]
  const deSalida = (campo: string) => (indice != null ? `salidas.${indice}.${campo}` : 'salidas')

  if (pg.code === 'P0001') {
    switch (pg.hint) {
      case 'stock_insuficiente':
        return { mensaje: pg.message, campo: 'peso_entrada_kg' }
      case 'lote_no_disponible':
        return { mensaje: pg.message, campo: 'lote_origen_id' }
      case 'origen_invalido':
        return { mensaje: pg.message, campo: 'producto_origen_id' }
      case 'destino_invalido':
      case 'destino_no_corresponde':
      case 'salida_duplicada':
        return { mensaje: pg.message, campo: deSalida('producto_destino_id') }
      case 'precio_requerido':
        return { mensaje: pg.message, campo: deSalida('precio_referencia_usd_kg') }
      case 'salidas_exceden_entrada':
        return { mensaje: pg.message, campo: 'salidas' }
    }
  }
  if (pg.code === '23514' && pg.message.includes('salida_menor_entrada')) {
    return {
      mensaje: 'La suma de las salidas no puede superar el peso de entrada',
      campo: 'salidas',
    }
  }
  if (pg.code === '23514' && indice != null) {
    const campo = pg.message.includes('precio') ? 'precio_referencia_usd_kg' : 'peso_salida_kg'
    return { mensaje: pg.message, campo: `salidas.${indice}.${campo}` }
  }
  return null
}
