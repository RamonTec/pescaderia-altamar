import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lote, Producto } from '@/types/domain'
import { makeLoteRepository } from '@/lib/repositories/loteRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'

/**
 * CostingService (SRP): transferencia de costo en el procesamiento y
 * valorización del stock por lote (/SPEC.md §4.1 y §4.3, 07-lotes).
 *
 *   - Costo por lote (identificación específica): cada lote conserva su
 *     costo/kg USD; el valor del inventario es Σ(stock_lote × costo_lote).
 *     Reemplaza el promedio ponderado (decisión reabierta el 2026-10-07).
 *   - El "costo promedio" de un producto es solo informativo:
 *     valor de sus lotes / kg en stock.
 *   - Transferencia total en el procesamiento (la merma encarece el kg neto):
 *     costo_kg_destino = (peso_entrada × costo_kg_lote_origen) / peso_salida.
 *     La aplica la RPC `registrar_procesamiento`; `costoDestino` se usa en la
 *     UI para merma, rendimiento y (solo admin) el costo resultante.
 *
 * Sin importar el cliente de Supabase del servidor: `costoDestino` se usa
 * en componentes cliente. Las funciones con datos reciben `db`.
 */

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

/** Stock y valor de un producto a partir de sus lotes abiertos. */
export interface InventarioProducto {
  producto: Producto
  stock_kg: number
  /** Lotes abiertos con stock. */
  lotes: Lote[]
  /** Fecha de ingreso del lote abierto más antiguo (PEPS). */
  lote_mas_antiguo: string | null
  /** Σ(stock_lote × costo_lote); `null` sin permiso de costos (operador). */
  valor_usd: number | null
  /** Informativo: valor / kg en stock. */
  costo_promedio_usd_kg: number | null
  valor_bs: number | null
  /** Stock ≤ umbral de `config_negocio` (solo productos con control de stock). */
  stock_bajo: boolean
}

export interface InventarioPorLotes {
  items: InventarioProducto[]
  total_usd: number | null
  total_bs: number | null
}

const redondea3 = (n: number) => Math.round(n * 1000) / 1000

/** Agrupa lotes abiertos por producto y los valoriza (puro, testeable). */
export function valorizarLotes(
  productos: Producto[],
  lotes: Lote[],
  bsPorUsd: number | null,
  umbralStockBajoKg: number | null = null
): InventarioPorLotes {
  const porProducto = new Map<string, Lote[]>()
  for (const l of lotes) {
    if (l.estado !== 'abierto' || l.stock_kg <= 0) continue
    const lista = porProducto.get(l.producto_id) ?? []
    lista.push(l)
    porProducto.set(l.producto_id, lista)
  }

  const sinCostos = lotes.some((l) => l.costo_usd_kg == null)
  const items: InventarioProducto[] = productos.map((producto) => {
    const propios = (porProducto.get(producto.id) ?? []).sort(
      (a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso) || a.codigo.localeCompare(b.codigo)
    )
    const stock = redondea3(propios.reduce((s, l) => s + l.stock_kg, 0))
    const valor = sinCostos
      ? null
      : propios.reduce((s, l) => s + l.stock_kg * Number(l.costo_usd_kg ?? 0), 0)
    return {
      producto,
      stock_kg: stock,
      lotes: propios,
      lote_mas_antiguo: propios[0]?.fecha_ingreso ?? null,
      valor_usd: valor,
      costo_promedio_usd_kg: valor != null && stock > 0 ? valor / stock : null,
      valor_bs: valor != null && bsPorUsd ? valor * bsPorUsd : null,
      stock_bajo:
        producto.controla_stock && umbralStockBajoKg != null && stock <= umbralStockBajoKg,
    }
  })

  const totalUsd = sinCostos ? null : items.reduce((s, i) => s + (i.valor_usd ?? 0), 0)
  return {
    items,
    total_usd: totalUsd,
    total_bs: totalUsd != null && bsPorUsd ? totalUsd * bsPorUsd : null,
  }
}

/**
 * Inventario valorizado por lote de los productos activos: stock, lotes
 * abiertos, valor USD/Bs (Bs a la tasa vigente que recibe) y costo promedio
 * informativo. Costos `null` para el operador (`lotes_view`).
 */
export async function getInventarioPorLotes(
  bsPorUsd: number | null,
  db: SupabaseClient,
  umbralStockBajoKg: number | null = null
): Promise<InventarioPorLotes> {
  const [productos, lotes] = await Promise.all([
    makeProductoRepository(db).list(),
    makeLoteRepository(db).listAbiertosTodos(),
  ])
  return valorizarLotes(
    productos.filter((p) => p.activo),
    lotes,
    bsPorUsd,
    umbralStockBajoKg
  )
}

/** Stock (kg) por producto: Σ stock de sus lotes abiertos. */
export async function getStockPorProducto(db: SupabaseClient): Promise<Map<string, number>> {
  const lotes = await makeLoteRepository(db).listAbiertosTodos()
  const stocks = new Map<string, number>()
  for (const l of lotes) {
    stocks.set(l.producto_id, redondea3((stocks.get(l.producto_id) ?? 0) + l.stock_kg))
  }
  return stocks
}
