import type { DetalleFactura, TrazabilidadFactura } from '@/types/domain'
import { margenFactura, margenLinea } from './margen'
import { senalesLinea, senalFactura } from './senales'
import { redondea6 } from './totales'

/**
 * Arma la ficha de una factura (17) a partir de la trazabilidad de la RPC:
 * margen y señales por línea, margen neto y nivel de la factura, saldo o
 * saldo a favor. Función pura (la usa `trazabilidadFacturaService`).
 */
export function armarDetalleFactura(traza: TrazabilidadFactura, toleranciaPct: number): DetalleFactura {
  const lineas = traza.lineas.map((l) => ({
    ...l,
    margen: margenLinea(l),
    senales: senalesLinea(l, toleranciaPct),
  }))
  const creditos = redondea6(
    traza.notas_credito.filter((n) => n.estado === 'emitida').reduce((s, n) => s + n.total_usd, 0)
  )
  const saldo = redondea6(traza.factura.total_usd - traza.factura.pagado_usd - creditos)
  return {
    ...traza,
    lineas,
    saldo: {
      creditos_usd: creditos,
      // La anulada no tiene saldo (como la cartera).
      saldo_usd: traza.factura.estado === 'anulada' ? 0 : Math.max(saldo, 0),
      saldo_a_favor_usd: traza.factura.estado === 'anulada' ? 0 : Math.max(-saldo, 0),
    },
    margen: margenFactura(lineas, traza.notas_credito),
    senales: senalFactura(lineas.map((l) => l.senales)),
    tolerancia_precio_ref_pct: toleranciaPct,
  }
}
