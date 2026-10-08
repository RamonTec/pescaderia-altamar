import type {
  ClienteRanking,
  CondicionPago,
  DiasFlujo,
  FilaFlujo,
  FilaMezclaVentas,
  FilaTopCliente,
  FlujoProyectado,
  MetodoPago,
  MezclaVentas,
  Moneda,
  ParteMezcla,
  TopClientesPareto,
  TramoAging,
  TramoAgingId,
  ValorInventarioProducto,
} from '@/types/domain'

/**
 * Series y agregados del dashboard (15). Puro: sin Supabase ni React. Lo
 * usan el servicio (servidor) y los gráficos (relleno de huecos).
 */

/** Corte del Pareto (B12). */
export const CORTE_PARETO = 0.8

const EPS = 1e-9

/**
 * Una fila por clave, en el orden de `claves`: las que faltan se crean con
 * `vacio(clave)` (días/semanas/meses sin datos en 0 o sin valor).
 */
export function rellenarSerie<T>(
  claves: readonly string[],
  filas: readonly T[],
  claveDe: (fila: T) => string,
  vacio: (clave: string) => T
): T[] {
  const porClave = new Map(filas.map((f): [string, T] => [claveDe(f).slice(0, 10), f]))
  return claves.map((k) => porClave.get(k) ?? vacio(k))
}

/**
 * Pareto de clientes: % de cada uno sobre el total del período, % acumulado y
 * corte del 80 % (el primero cuyo acumulado llega al 80 %, inclusive). Si los
 * primeros no suman el total, agrega "Resto" con la diferencia.
 */
export function paretoAcumulado(
  filas: readonly Pick<FilaTopCliente, 'cliente_id' | 'cliente_nombre' | 'ventas_usd' | 'facturas'>[],
  totalPeriodoUsd: number,
  clientesPeriodo: number
): TopClientesPareto {
  const total = totalPeriodoUsd
  if (!(total > 0)) {
    return { clientes: [], total_usd: 0, clientes_periodo: clientesPeriodo, indice_corte_80: null }
  }
  const base: Omit<ClienteRanking, 'pct' | 'pct_acumulado' | 'dentro_80'>[] = filas.map((f) => ({
    cliente_id: f.cliente_id,
    cliente_nombre: f.cliente_nombre,
    ventas_usd: f.ventas_usd,
    facturas: f.facturas,
  }))
  const resto = total - filas.reduce((s, f) => s + f.ventas_usd, 0)
  if (resto > 0.005) {
    base.push({ cliente_id: null, cliente_nombre: 'Resto', ventas_usd: resto, facturas: null })
  }

  let acumulado = 0
  let corte: number | null = null
  const clientes = base.map((c, i): ClienteRanking => {
    const pct = c.ventas_usd / total
    acumulado += pct
    if (corte === null && acumulado >= CORTE_PARETO - EPS) corte = i
    return { ...c, pct, pct_acumulado: Math.min(acumulado, 1), dentro_80: corte === null || corte === i }
  })
  return { clientes, total_usd: total, clientes_periodo: clientesPeriodo, indice_corte_80: corte }
}

export const ORDEN_TRAMOS_AGING: readonly TramoAgingId[] = ['por_vencer', '1-15', '16-30', '>30']

/** Tramos de aging en orden fijo; los que falten, en 0. */
export function ordenarTramosAging(tramos: readonly TramoAging[]): TramoAging[] {
  return ORDEN_TRAMOS_AGING.map(
    (id, i) =>
      tramos.find((t) => t.tramo === id) ?? { tramo: id, orden: i + 1, saldo_usd: 0, facturas: 0 }
  )
}

/** Flujo proyectado: serie diaria con neto y acumulado; lo vencido aparte (C3). */
export function flujoAcumulado(filas: readonly FilaFlujo[], dias: DiasFlujo): FlujoProyectado {
  const vencido = filas.find((f) => f.tipo === 'vencido')
  let acumulado = 0
  const serie = filas
    .filter((f): f is FilaFlujo & { fecha: string } => f.tipo === 'dia' && f.fecha !== null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((f) => {
      const neto = f.cobros_usd - f.pagos_usd
      acumulado += neto
      return {
        fecha: f.fecha.slice(0, 10),
        cobros_usd: f.cobros_usd,
        pagos_usd: f.pagos_usd,
        neto_usd: neto,
        acumulado_usd: acumulado,
      }
    })
  return {
    dias,
    serie,
    vencido_cobros_usd: vencido?.cobros_usd ?? 0,
    vencido_pagos_usd: vencido?.pagos_usd ?? 0,
  }
}

function partes<K extends string>(
  filas: readonly FilaMezclaVentas[],
  grupo: FilaMezclaVentas['grupo']
): ParteMezcla<K>[] {
  const propias = filas.filter((f) => f.grupo === grupo)
  const total = propias.reduce((s, f) => s + f.usd, 0)
  return propias
    .map((f) => ({
      clave: f.clave as K,
      usd: f.usd,
      cantidad: f.cantidad,
      pct: total > 0 ? f.usd / total : null,
    }))
    .sort((a, b) => b.usd - a.usd)
}

/** Contado vs crédito (B9), métodos y monedas de cobro (B10) y ticket promedio (B11). */
export function mezclaDesdeFilas(filas: readonly FilaMezclaVentas[]): MezclaVentas {
  const total = filas.find((f) => f.grupo === 'total')
  const ventas = total?.usd ?? 0
  const facturas = total?.cantidad ?? 0
  const kg = total?.kg ?? 0
  return {
    ventas_usd: ventas,
    facturas,
    kg,
    ticket_promedio_usd: facturas > 0 ? ventas / facturas : null,
    kg_por_factura: facturas > 0 ? kg / facturas : null,
    condicion: partes<CondicionPago>(filas, 'condicion'),
    metodos: partes<MetodoPago>(filas, 'metodo'),
    monedas: partes<Moneda>(filas, 'moneda'),
  }
}

/** Primeros `limite` productos por valor y el resto agrupado (D2 del alcance). */
export function topConResto(
  productos: readonly ValorInventarioProducto[],
  limite: number
): ValorInventarioProducto[] {
  const orden = [...productos].sort((a, b) => b.valor_usd - a.valor_usd)
  if (orden.length <= limite) return orden
  const resto = orden.slice(limite)
  const sumaBs = resto.every((p) => p.valor_bs !== null)
    ? resto.reduce((s, p) => s + (p.valor_bs ?? 0), 0)
    : null
  return [
    ...orden.slice(0, limite),
    {
      producto_id: null,
      producto_nombre: `Resto (${resto.length})`,
      lotes: resto.reduce((s, p) => s + p.lotes, 0),
      stock_kg: resto.reduce((s, p) => s + p.stock_kg, 0),
      valor_usd: resto.reduce((s, p) => s + p.valor_usd, 0),
      valor_bs: sumaBs,
    },
  ]
}
