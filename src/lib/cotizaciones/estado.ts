/**
 * Estados de una cotización (21-cotizaciones, P5): funciones puras, espejo
 * de `cotizaciones_guard`. `vencida` es derivada (sin cron).
 */
import type { EstadoCotizacion, EstadoEfectivoCotizacion } from '@/types/domain'

/** `vencida` si está abierta (`borrador`/`enviada`) y `fecha_vencimiento < hoy` (Caracas). */
export function estadoEfectivo(
  c: { estado: EstadoCotizacion; fecha_vencimiento: string },
  hoy: string
): EstadoEfectivoCotizacion {
  if ((c.estado === 'borrador' || c.estado === 'enviada') && c.fecha_vencimiento < hoy) return 'vencida'
  return c.estado
}

export type AccionCotizacion =
  | 'editar'
  | 'compartir'
  | 'descargar_pdf'
  | 'aceptar'
  | 'rechazar'
  | 'renovar'
  | 'duplicar'
  | 'convertir_pedido'
  | 'anular'

/**
 * Acciones disponibles según el estado efectivo (las mismas transiciones que
 * permite el guard). Una vencida no se acepta ni se comparte sin renovar
 * (P7); una anulada no tiene PDF; una aceptada con pedido no se anula.
 */
export function accionesPermitidas(
  estado: EstadoEfectivoCotizacion,
  tienePedido = false
): ReadonlySet<AccionCotizacion> {
  switch (estado) {
    case 'borrador':
    case 'enviada':
      return new Set<AccionCotizacion>([
        'editar', 'compartir', 'descargar_pdf', 'aceptar', 'rechazar', 'renovar', 'duplicar', 'anular',
      ])
    case 'vencida':
      return new Set<AccionCotizacion>(['editar', 'descargar_pdf', 'rechazar', 'renovar', 'duplicar', 'anular'])
    case 'aceptada': {
      const a = new Set<AccionCotizacion>(['compartir', 'descargar_pdf', 'duplicar'])
      if (!tienePedido) {
        a.add('convertir_pedido')
        a.add('anular')
      }
      return a
    }
    case 'rechazada':
      return new Set<AccionCotizacion>(['compartir', 'descargar_pdf', 'duplicar', 'anular'])
    case 'anulada':
      return new Set<AccionCotizacion>(['duplicar'])
  }
}

export const ETIQUETA_ESTADO_COTIZACION: Record<EstadoEfectivoCotizacion, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  vencida: 'Vencida',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
}

/** Suma `dias` a una fecha `YYYY-MM-DD` (sin zona horaria). */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const f = new Date(Date.UTC(y, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}

/** Días que faltan para el vencimiento (negativo si ya venció). */
export function diasParaVencer(fechaVencimiento: string, hoy: string): number {
  const a = Date.parse(`${fechaVencimiento}T00:00:00Z`)
  const b = Date.parse(`${hoy}T00:00:00Z`)
  return Math.round((a - b) / 86_400_000)
}
