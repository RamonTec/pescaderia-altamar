import type { ConfigNegocio, Lote, ResultadoLote, TrazabilidadLote } from '@/types/domain'
import { fechaHoy } from '@/lib/format'

/**
 * Cálculos puros de lotes (07-lotes), sin acceso a datos: se usan en el
 * servidor (`loteService` los re-exporta) y en componentes cliente
 * (días en cava, "antiguo", % restante, tarjeta de resultado).
 */

const MS_DIA = 24 * 60 * 60 * 1000

function diaUtc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

/** Días que lleva el lote desde su ingreso (fecha de compra o de procesamiento). */
export function diasEnCava(lote: Pick<Lote, 'fecha_ingreso'>, hoy: string = fechaHoy()): number {
  return Math.max(0, Math.round((diaUtc(hoy) - diaUtc(lote.fecha_ingreso)) / MS_DIA))
}

/** Lote abierto que supera `config_negocio.dias_alerta_lote` (pescado fresco). */
export function esAntiguo(
  lote: Pick<Lote, 'fecha_ingreso' | 'estado'>,
  config: Pick<ConfigNegocio, 'dias_alerta_lote'> | null | undefined,
  hoy: string = fechaHoy()
): boolean {
  const limite = config?.dias_alerta_lote
  if (lote.estado !== 'abierto' || limite == null || limite <= 0) return false
  return diasEnCava(lote, hoy) >= limite
}

/** % restante del lote (0–100), para la barra del listado. */
export function porcentajeRestante(lote: Pick<Lote, 'stock_kg' | 'peso_inicial_kg'>): number {
  if (lote.peso_inicial_kg <= 0) return 0
  return Math.max(0, Math.min(100, (lote.stock_kg / lote.peso_inicial_kg) * 100))
}

export const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6
export const redondea3 = (n: number) => Math.round(n * 1e3) / 1e3

/**
 * Resultado de un lote y sus hijos para los kg vendidos y perdidos
 * (spec 07-lotes, "Trazabilidad y resultado por lote"):
 *
 *   - USD: ingreso − costo vendido − costo perdido.
 *   - Bs a tasas históricas: Σ(venta_usd × tasa_factura) − Σ(costo_usd ×
 *     tasa de compra del lote), vendido + perdido.
 *   - Efecto cambiario: resultado Bs − resultado USD × tasa de compra.
 *
 * Las devoluciones (notas emitidas con `afecta_inventario`) restan su venta
 * y su costo; las ventas de facturas anuladas no cuentan. El costo de cada
 * lote es fijo (el de un procesado ya incluye la merma), por eso el
 * `proceso_out` del padre no es costo: pasa al hijo.
 *
 * Requiere costos (admin): si alguno llega `null`, devuelve `null`.
 */
export function resultadoLote(t: TrazabilidadLote): ResultadoLote | null {
  const lotes = new Map(t.arbol.map((l): [string, Lote] => [l.id, l]))
  if (t.arbol.some((l) => l.costo_usd_kg == null)) return null
  const costoDe = (loteId: string) => Number(lotes.get(loteId)?.costo_usd_kg ?? 0)
  const tasaDe = (loteId: string) => Number(lotes.get(loteId)?.tasa_snapshot ?? 0)

  let kgVendidos = 0
  let ingresoUsd = 0
  let ingresoBs = 0
  let costoVendidoUsd = 0
  let costoVendidoBs = 0

  for (const v of t.ventas) {
    if (v.factura_estado === 'anulada') continue
    const venta = v.peso_kg * v.precio_usd_kg
    const costo = v.peso_kg * (v.costo_usd_kg ?? costoDe(v.lote_id))
    kgVendidos += v.peso_kg
    ingresoUsd += venta
    ingresoBs += venta * v.tasa_factura
    costoVendidoUsd += costo
    costoVendidoBs += costo * tasaDe(v.lote_id)
  }

  for (const d of t.devoluciones) {
    if (d.nota_estado !== 'emitida') continue
    const venta = d.peso_kg * d.precio_usd_kg
    const costo = d.peso_kg * costoDe(d.lote_id)
    kgVendidos -= d.peso_kg
    ingresoUsd -= venta
    ingresoBs -= venta * d.tasa_factura
    costoVendidoUsd -= costo
    costoVendidoBs -= costo * tasaDe(d.lote_id)
  }

  let kgPerdidos = 0
  let costoPerdidoUsd = 0
  let costoPerdidoBs = 0
  for (const p of t.perdidas) {
    const costo = p.peso_kg * costoDe(p.lote_id)
    kgPerdidos += p.peso_kg
    costoPerdidoUsd += costo
    costoPerdidoBs += costo * tasaDe(p.lote_id)
  }

  const entrada = t.procesos.reduce((s, p) => s + p.peso_entrada_kg, 0)
  const salida = t.procesos.reduce((s, p) => s + p.peso_salida_kg, 0)

  const resultadoUsd = ingresoUsd - costoVendidoUsd - costoPerdidoUsd
  const resultadoBs = ingresoBs - costoVendidoBs - costoPerdidoBs
  const tasaCompra = Number(t.lote.tasa_snapshot)

  return {
    kgVendidos: redondea3(kgVendidos),
    kgPerdidos: redondea3(kgPerdidos),
    ingresoUsd: redondea6(ingresoUsd),
    costoVendidoUsd: redondea6(costoVendidoUsd),
    costoPerdidoUsd: redondea6(costoPerdidoUsd),
    resultadoUsd: redondea6(resultadoUsd),
    resultadoBs: redondea6(resultadoBs),
    efectoCambiarioBs: redondea6(resultadoBs - resultadoUsd * tasaCompra),
    mermaKg: redondea3(entrada - salida),
    rendimiento: entrada > 0 ? salida / entrada : null,
  }
}
