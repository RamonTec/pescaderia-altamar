import type { SupabaseClient } from '@supabase/supabase-js'
import type { Lote, Producto, RepartoCosto } from '@/types/domain'

/**
 * Repositorios con import dinámico: así el módulo no arrastra clientes de
 * Supabase al cargarse, y las funciones puras (`repartirCostoProceso`,
 * `prorratearEntrada`, `valorizarLotes`) se usan en componentes cliente y en
 * `scripts/probar-procesamiento.ts` sin configuración.
 */
const repositorios = async () => {
  const [{ makeLoteRepository }, { makeProductoRepository }] = await Promise.all([
    import('@/lib/repositories/loteRepository'),
    import('@/lib/repositories/catalogRepositories'),
  ])
  return { makeLoteRepository, makeProductoRepository }
}

/**
 * CostingService (SRP): reparto del costo del procesamiento y valorización
 * del stock por lote (/SPEC.md §4.1 y §4.3, 07-lotes, 16).
 *
 *   - Costo por lote (identificación específica): cada lote conserva su
 *     costo/kg USD; el valor del inventario es Σ(stock_lote × costo_lote).
 *     Reemplaza el promedio ponderado (decisión reabierta el 2026-10-07).
 *   - El "costo promedio" de un producto es solo informativo:
 *     valor de sus lotes / kg en stock.
 *   - Procesamiento multisalida (2026-10-19, 16): el costo total de la
 *     entrada (`peso_entrada × costo_kg_lote`) se reparte entre las N salidas
 *     **por valor de venta** (`kg × precio de referencia`); si todos los
 *     precios son 0, o hay una sola salida, por kg. La merma encarece el kg
 *     neto. Lo aplica la RPC `registrar_procesamiento`; `repartirCostoProceso`
 *     es su espejo exacto para la UI (mismos enteros y mismo redondeo
 *     half-up), y `prorratearEntrada` reparte la entrada por kg entre las
 *     líneas (dato técnico).
 *
 * Sin importar el cliente de Supabase del servidor: las funciones puras se
 * usan en componentes cliente. Las funciones con datos reciben `db`.
 */

// ---------- Aritmética entera (espejo de la RPC) ----------
// Milésimas de kg y micro-USD como BigInt: sin errores de coma flotante, el
// resultado coincide con el `numeric` de Postgres. `BigInt(n)` en lugar de
// literales `0n` por el `target` ES2017 del proyecto.
const B0 = BigInt(0)
const B1 = BigInt(1)
const B2 = BigInt(2)
const MIL = BigInt(1000)

/** Entero escalado: `round(n × 10^decimales)` (half-up, n ≥ 0). */
function escalar(n: number, decimales: number): bigint {
  // `toFixed` redondea sobre la representación decimal: evita que 0.1 × 1000
  // dé 99.99999. Un valor no numérico (campo a medio escribir) cuenta como 0.
  if (!Number.isFinite(n)) return B0
  return BigInt(n.toFixed(decimales).replace('.', ''))
}

/** round(a / b) half-up para a ≥ 0, b > 0 (igual que la RPC). */
function divRedondeo(a: bigint, b: bigint): bigint {
  return (B2 * a + b) / (B2 * b)
}

const desescalar = (n: bigint, decimales: number) => Number(n) / 10 ** decimales

/**
 * Reparte `totalMicro` según `pesos` (≥ 0, Σ > 0). El residuo de redondeo va
 * al de mayor peso (el primero si empatan): Σ resultado = totalMicro exacto.
 */
function repartirEnteros(totalMicro: bigint, pesos: bigint[]): bigint[] {
  if (pesos.length === 0) return []
  let suma = B0
  let max = 0
  pesos.forEach((w, i) => {
    suma += w
    if (w > pesos[max]) max = i
  })
  if (suma <= B0) return pesos.map(() => B0)
  const res = pesos.map((w) => divRedondeo(totalMicro * w, suma))
  const asignado = res.reduce((s, c) => s + c, B0)
  res[max] += totalMicro - asignado
  return res
}

/**
 * Entrada prorrateada por kg de salida (milésimas, floor + mayor resto, el
 * primero si empatan). Con `Σ kg ≤ entrada` garantiza `e_i ≥ kg_i` (check
 * `salida_menor_entrada`) y `Σ e_i = entrada`. Espejo de
 * `procesamiento_prorratear_entrada`.
 */
export function prorratearEntrada(pesoEntradaKg: number, kgSalidas: number[]): number[] {
  if (kgSalidas.length === 0) return []
  const entrada = escalar(pesoEntradaKg, 3)
  const kgs = kgSalidas.map((k) => escalar(k, 3))
  const suma = kgs.reduce((s, k) => s + k, B0)
  if (suma <= B0) return kgSalidas.map(() => 0)
  const res = kgs.map((k) => (entrada * k) / suma)
  const restos = kgs.map((k) => (entrada * k) % suma)
  let faltan = entrada - res.reduce((s, e) => s + e, B0)
  while (faltan > B0) {
    let mejor = 0
    for (let i = 1; i < restos.length; i++) if (restos[i] > restos[mejor]) mejor = i
    res[mejor] += B1
    restos[mejor] = -B1
    faltan -= B1
  }
  return res.map((e) => desescalar(e, 3))
}

export interface SalidaReparto {
  kg: number
  /** Precio de referencia USD/kg; `null` = sin precio. */
  precio: number | null
}

export interface RepartoSalida {
  costo_usd: number
  costo_usd_kg: number
  /** Parte del costo total (0–1). */
  participacion_costo: number
  /** Parte de la entrada (kg_i / entrada, 0–1). */
  participacion_kg: number
}

export interface RepartoProceso {
  costo_total_usd: number
  salida_total_kg: number
  merma_kg: number
  /** merma / entrada (0–1). */
  merma_pct: number
  /** Σ salidas / entrada (0–1). */
  rendimiento: number
  reparto: RepartoCosto
  salidas: RepartoSalida[]
}

/**
 * Reparto del costo de un procesamiento entre sus salidas (16, espejo de la
 * RPC `registrar_procesamiento`):
 *
 *   1. costo_total = round(entrada × costo_lote, 6).
 *   2. w_i = kg_i × precio_i (`valor`). Con una sola salida, o si Σ w = 0
 *      (todos los precios en 0 o sin precio), w_i = kg_i (`peso`).
 *   3. costo_i = round(costo_total × w_i / Σ w, 6), residuo a la de mayor w.
 *   4. costo_kg_i = round(costo_i / kg_i, 6).
 *
 * Una salida sin precio cuenta como precio 0 (con ≥ 2 salidas la validación
 * la rechaza antes). Merma y rendimiento son del proceso completo.
 */
export function repartirCostoProceso({
  pesoEntradaKg,
  costoLoteUsdKg,
  salidas,
}: {
  pesoEntradaKg: number
  costoLoteUsdKg: number
  salidas: SalidaReparto[]
}): RepartoProceso {
  const entradaMil = escalar(pesoEntradaKg, 3)
  const costoTotalMicro = divRedondeo(entradaMil * escalar(costoLoteUsdKg, 6), MIL)
  const kgsMil = salidas.map((s) => escalar(s.kg, 3))
  const valores = salidas.map((s, i) => kgsMil[i] * escalar(s.precio ?? 0, 6))
  const sumaValor = valores.reduce((s, v) => s + v, B0)
  const reparto: RepartoCosto = salidas.length >= 2 && sumaValor > B0 ? 'valor' : 'peso'
  const costosMicro = repartirEnteros(costoTotalMicro, reparto === 'valor' ? valores : kgsMil)

  const costoTotal = desescalar(costoTotalMicro, 6)
  const salidaTotalMil = kgsMil.reduce((s, k) => s + k, B0)
  const salidaTotal = desescalar(salidaTotalMil, 3)
  const entrada = desescalar(entradaMil, 3)
  const merma = desescalar(entradaMil - salidaTotalMil, 3)

  return {
    costo_total_usd: costoTotal,
    salida_total_kg: salidaTotal,
    merma_kg: merma,
    merma_pct: entrada > 0 ? merma / entrada : 0,
    rendimiento: entrada > 0 ? salidaTotal / entrada : 0,
    reparto,
    salidas: costosMicro.map((c, i) => ({
      costo_usd: desescalar(c, 6),
      costo_usd_kg: kgsMil[i] > B0 ? desescalar(divRedondeo(c * MIL, kgsMil[i]), 6) : 0,
      participacion_costo: costoTotalMicro > B0 ? Number(c) / Number(costoTotalMicro) : 0,
      participacion_kg: entrada > 0 ? desescalar(kgsMil[i], 3) / entrada : 0,
    })),
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
  const { makeLoteRepository, makeProductoRepository } = await repositorios()
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
  const { makeLoteRepository } = await repositorios()
  const lotes = await makeLoteRepository(db).listAbiertosTodos()
  const stocks = new Map<string, number>()
  for (const l of lotes) {
    stocks.set(l.producto_id, redondea3((stocks.get(l.producto_id) ?? 0) + l.stock_kg))
  }
  return stocks
}
