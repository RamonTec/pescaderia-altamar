import type {
  CondicionPago,
  GrupoPedidoProximo,
  MetodoPago,
  Moneda,
  TipoContrato,
  TramoAgingId,
  TramoAntiguedadId,
} from '@/types/domain'

/** Etiquetas del dashboard (15). Puro: sin React. */

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo_usd: 'Efectivo USD',
  efectivo_bs: 'Efectivo Bs',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  punto: 'Punto de venta',
}

export const ETIQUETA_MONEDA: Record<Moneda, string> = { usd: 'USD', bs: 'Bs' }

export const ETIQUETA_CONDICION: Record<CondicionPago, string> = {
  contado: 'Contado',
  credito: 'Crédito',
}

export const ETIQUETA_TRAMO_AGING: Record<TramoAgingId, string> = {
  por_vencer: 'Por vencer',
  '1-15': '1–15 días',
  '16-30': '16–30 días',
  '>30': '> 30 días',
}

export const ETIQUETA_TRAMO_ANTIGUEDAD: Record<TramoAntiguedadId, string> = {
  '0-2': '0–2 días',
  '3-5': '3–5 días',
  '>5': '> 5 días',
}

export const ETIQUETA_GRUPO_PEDIDO: Record<GrupoPedidoProximo, string> = {
  atrasado: 'Atrasado',
  hoy: 'Hoy',
  manana: 'Mañana',
}

export const ETIQUETA_TIPO_CONTRATO: Record<TipoContrato, string> = {
  venta_credito: 'Venta a crédito',
  compra_credito: 'Compra a crédito',
}

/** `2026-10-01` → `oct 2026` (eje de meses). */
export function etiquetaMes(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-VE', { month: 'short', year: '2-digit' })
    .format(new Date(y, (m ?? 1) - 1, 1))
    .replace('.', '')
}

/** `2026-10-05` → `05 oct` (eje de días/semanas). */
export function etiquetaDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short' })
    .format(new Date(y, (m ?? 1) - 1, d ?? 1))
    .replace('.', '')
}
