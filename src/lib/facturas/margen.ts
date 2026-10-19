import type { MargenLinea } from '@/types/domain'
import { redondea6 } from './totales'

/**
 * Margen de una factura (17): USD y sin IVA, con la misma regla que
 * `dashboard_lineas_venta` (15). Funciones puras.
 *
 *   Línea:   venta = peso × precio, costo = peso × costo_usd_kg,
 *            margen = venta − costo, margen % = margen / venta (`null` si venta 0).
 *   Factura: Σ margen de líneas − Σ (nci.peso × nci.precio − nci.peso × fi.costo_usd_kg)
 *            de las notas de crédito emitidas.
 */

export interface LineaMargen {
  id: string
  peso_kg: number
  precio_usd_kg: number
  costo_usd_kg: number
}

export interface NotaMargen {
  estado: 'emitida' | 'anulada'
  items: { factura_item_id: string; peso_kg: number; precio_usd_kg: number }[]
}

function margenDe(venta: number, costo: number): MargenLinea {
  const v = redondea6(venta)
  const c = redondea6(costo)
  const margen = redondea6(v - c)
  return { venta_usd: v, costo_usd: c, margen_usd: margen, margen_pct: v === 0 ? null : margen / v }
}

export function margenLinea(linea: Omit<LineaMargen, 'id'>): MargenLinea {
  return margenDe(linea.peso_kg * linea.precio_usd_kg, linea.peso_kg * linea.costo_usd_kg)
}

/** Margen neto de la factura: líneas menos lo devuelto por notas emitidas (al costo de la línea). */
export function margenFactura(lineas: readonly LineaMargen[], notas: readonly NotaMargen[]): MargenLinea {
  const costoPorLinea = new Map(lineas.map((l) => [l.id, l.costo_usd_kg]))
  let venta = 0
  let costo = 0
  for (const l of lineas) {
    venta += l.peso_kg * l.precio_usd_kg
    costo += l.peso_kg * l.costo_usd_kg
  }
  for (const n of notas) {
    if (n.estado !== 'emitida') continue
    for (const i of n.items) {
      venta -= i.peso_kg * i.precio_usd_kg
      costo -= i.peso_kg * (costoPorLinea.get(i.factura_item_id) ?? 0)
    }
  }
  return margenDe(venta, costo)
}
