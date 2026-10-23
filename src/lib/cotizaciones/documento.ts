/**
 * Datos de solo lectura de una cotización para `CotizacionDocumento` y el
 * PDF (21-cotizaciones): función pura que descarta todo lo interno.
 */
import type { CotizacionDetalle, CotizacionDocumentoDatos } from '@/types/domain'

export function documentoDesdeDetalle(d: CotizacionDetalle): CotizacionDocumentoDatos {
  return {
    numero: d.numero,
    fecha: d.fecha,
    fecha_vencimiento: d.fecha_vencimiento,
    cliente: d.cliente
      ? { nombre: d.cliente.nombre, rif_ci: d.cliente.rif_ci, telefono: null }
      : { nombre: d.cliente_nombre ?? '—', rif_ci: null, telefono: d.cliente_telefono },
    items: d.items.map((i) => ({
      producto_nombre: i.producto_nombre,
      peso_kg: i.peso_kg,
      precio_usd_kg: i.precio_usd_kg,
      subtotal_usd: i.subtotal_usd,
      nota: i.nota,
    })),
    subtotal_usd: d.subtotal_usd,
    descuento_usd: d.descuento_usd,
    iva_pct: d.iva_pct,
    iva_usd: d.iva_usd,
    total_usd: d.total_usd,
    notas_cliente: d.notas_cliente,
    terminos: d.terminos,
  }
}
