import type { Movimiento, Producto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * CostingService (SRP): solo costeo ponderado y valorización.
 * Fórmulas:
 *   - Promedio ponderado en cada entrada.
 *   - Transferencia total de costo en procesamiento (la merma encarece el kg neto):
 *     costo_kg_destino = (peso_entrada × costo_kg_origen) / peso_salida
 */

export interface StockProducto {
  producto: Producto
  stock_kg: number
  costo_usd_kg: number
  valor_usd: number
}

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

export async function getStockProducto(productoId: string): Promise<StockProducto | null> {
  const db = createClient()
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

  let stockKg = 0
  let costoTotal = 0
  for (const m of movs) {
    const peso = Number(m.peso_kg)
    if (m.costo_usd_kg === 0 && peso < 0) {
      costoTotal += peso * (stockKg > 0 ? costoTotal / stockKg : 0)
    } else if (peso > 0) {
      costoTotal += peso * Number(m.costo_usd_kg)
    } else {
      costoTotal += peso * (stockKg > 0 ? costoTotal / stockKg : 0)
    }
    stockKg += peso
  }

  const producto = movs[0]?.producto
  if (!producto) return null
  return {
    producto,
    stock_kg: Math.round(stockKg * 1000) / 1000,
    costo_usd_kg: stockKg > 0 ? costoTotal / stockKg : 0,
    valor_usd: costoTotal,
  }
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
    let stockKg = 0
    let costoTotal = 0
    for (const m of rows) {
      const peso = Number(m.peso_kg)
      const costo = stockKg > 0 ? costoTotal / stockKg : 0
      costoTotal += peso > 0 ? peso * Number(m.costo_usd_kg) : peso * costo
      stockKg += peso
    }
    items.push({
      producto: p,
      stock_kg: Math.round(stockKg * 1000) / 1000,
      costo_usd_kg: stockKg > 0 ? costoTotal / stockKg : 0,
      valor_usd: costoTotal,
    })
  }

  const totalUsd = items.reduce((s, i) => s + i.valor_usd, 0)
  return { items, total_usd: totalUsd, total_bs: totalUsd * bsPorUsd }
}

export type { Movimiento }
