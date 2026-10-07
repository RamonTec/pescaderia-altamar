import type { SupabaseClient } from '@supabase/supabase-js'
import type { Movimiento, Producto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * CostingService (SRP): solo costeo ponderado y valorización.
 * Fórmulas:
 *   - Promedio ponderado en cada entrada.
 *   - Transferencia total de costo en procesamiento (la merma encarece el kg neto):
 *     costo_kg_destino = (peso_entrada × costo_kg_origen) / peso_salida
 *
 * `stock_y_costo_producto` (0013) repite `acumularMovimientos` en SQL para el
 * registro de procesamientos: cambiar uno obliga a cambiar el otro.
 */

export interface StockProducto {
  producto: Producto
  stock_kg: number
  costo_usd_kg: number
  valor_usd: number
}

/** Stock de un producto; `costo_usd_kg` es `null` si el invocador no es admin (0003). */
export interface StockActual {
  stock_kg: number
  costo_usd_kg: number | null
}

type FilaMovimiento = { producto_id: string; peso_kg: number; costo_usd_kg: number | null }

export function costoPonderado(
  stockKg: number,
  costoActual: number,
  entradaKg: number,
  costoEntrada: number
): number {
  const totalKg = stockKg + entradaKg
  if (totalKg <= 0) return 0
  return (stockKg * costoActual + entradaKg * costoEntrada) / totalKg
}

export function costoDestino(
  pesoEntradaKg: number,
  costoOrigenKg: number,
  pesoSalidaKg: number
): { costo_total_usd: number; costo_kg_destino: number; merma_kg: number; rendimiento: number } {
  const costoTotal = pesoEntradaKg * costoOrigenKg
  return {
    costo_total_usd: costoTotal,
    costo_kg_destino: pesoSalidaKg > 0 ? costoTotal / pesoSalidaKg : 0,
    merma_kg: pesoEntradaKg - pesoSalidaKg,
    rendimiento: pesoEntradaKg > 0 ? pesoSalidaKg / pesoEntradaKg : 0,
  }
}

/**
 * Recorre movimientos en orden cronológico: las entradas suman `peso × costo`,
 * las salidas restan al costo promedio vigente.
 */
export function acumularMovimientos(
  movs: Array<{ peso_kg: number; costo_usd_kg: number | null }>
): { stock_kg: number; costo_usd_kg: number; valor_usd: number } {
  let stockKg = 0
  let costoTotal = 0
  for (const m of movs) {
    const peso = Number(m.peso_kg)
    const costo = stockKg > 0 ? costoTotal / stockKg : 0
    costoTotal += peso > 0 ? peso * Number(m.costo_usd_kg) : peso * costo
    stockKg += peso
  }
  return {
    stock_kg: Math.round(stockKg * 1000) / 1000,
    costo_usd_kg: stockKg > 0 ? costoTotal / stockKg : 0,
    valor_usd: costoTotal,
  }
}

/** PostgREST limita cada respuesta (1000 filas por defecto en Supabase). */
const PAGINA = 1000

/** Stock actual de todos los productos con movimientos, leyendo el ledger por páginas. */
export async function getStocks(db: SupabaseClient): Promise<Map<string, StockActual>> {
  const filas: FilaMovimiento[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await db
      .from('movimientos_view')
      .select('producto_id, peso_kg, costo_usd_kg')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw error
    filas.push(...((data ?? []) as FilaMovimiento[]))
    if (!data || data.length < PAGINA) break
  }

  const porProducto = new Map<string, FilaMovimiento[]>()
  for (const m of filas) {
    const lista = porProducto.get(m.producto_id) ?? []
    lista.push(m)
    porProducto.set(m.producto_id, lista)
  }

  const stocks = new Map<string, StockActual>()
  for (const [productoId, movs] of porProducto) {
    const { stock_kg, costo_usd_kg } = acumularMovimientos(movs)
    // Costo `null` en la vista = invocador sin permiso: no inventar un 0.
    const sinCosto = movs.some((m) => m.costo_usd_kg === null)
    stocks.set(productoId, { stock_kg, costo_usd_kg: sinCosto ? null : costo_usd_kg })
  }
  return stocks
}

export async function getStockProducto(
  productoId: string,
  db: SupabaseClient = createClient()
): Promise<StockProducto | null> {
  const { data, error } = await db
    .from('movimientos_view')
    .select('peso_kg, costo_usd_kg, producto:productos(*)')
    .eq('producto_id', productoId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const movs = (data ?? []) as unknown as Array<{
    peso_kg: number
    costo_usd_kg: number
    producto: Producto
  }>

  const producto = movs[0]?.producto
  if (!producto) return null
  return { producto, ...acumularMovimientos(movs) }
}

/**
 * Costo promedio actual de varios productos en una sola query (evita un
 * round-trip por item en `crearFactura`). Los productos sin movimientos no
 * aparecen en el map (costo 0 en el invocador).
 */
export async function getCostosPorProducto(
  productoIds: string[],
  db: SupabaseClient = createClient()
): Promise<Map<string, number>> {
  if (productoIds.length === 0) return new Map()
  const { data, error } = await db
    .from('movimientos_view')
    .select('producto_id, peso_kg, costo_usd_kg')
    .in('producto_id', productoIds)
    .order('created_at', { ascending: true })
  if (error) throw error

  const porProducto = new Map<string, FilaMovimiento[]>()
  for (const m of (data ?? []) as FilaMovimiento[]) {
    const lista = porProducto.get(m.producto_id) ?? []
    lista.push(m)
    porProducto.set(m.producto_id, lista)
  }

  const costos = new Map<string, number>()
  for (const [productoId, movs] of porProducto) {
    costos.set(productoId, acumularMovimientos(movs).costo_usd_kg)
  }
  return costos
}

export async function getInventarioValorizado(bsPorUsd: number): Promise<{
  items: StockProducto[]
  total_usd: number
  total_bs: number
}> {
  const db = createClient()
  const { data, error } = await db.from('productos').select('*').eq('activo', true).order('nombre')
  if (error) throw error
  const productos = (data ?? []) as Producto[]

  const items: StockProducto[] = []
  for (const p of productos) {
    const { data: movs } = await db
      .from('movimientos_view')
      .select('peso_kg, costo_usd_kg')
      .eq('producto_id', p.id)
      .order('created_at', { ascending: true })
    const rows = (movs ?? []) as unknown as Array<{ peso_kg: number; costo_usd_kg: number }>
    items.push({ producto: p, ...acumularMovimientos(rows) })
  }

  const totalUsd = items.reduce((s, i) => s + i.valor_usd, 0)
  return { items, total_usd: totalUsd, total_bs: totalUsd * bsPorUsd }
}

export type { Movimiento }
