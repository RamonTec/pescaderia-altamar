/**
 * Dominio compartido de cartera (09-cuentas-por-cobrar).
 *
 * El núcleo no conoce "factura" ni "cliente": trabaja sobre un documento de
 * cartera. Sirve igual para cuentas por cobrar (facturas, hoy) y por pagar
 * (compras a proveedores, después) sin modificarse: cada origen aporta su
 * adaptador (`facturaADocumentoCartera`, `compraADocumentoCartera`) junto a
 * su repositorio.
 *
 * Sin I/O ni imports de Supabase/React.
 */

import type { CanalRecordatorioId } from '../../types/domain'

export type { CanalRecordatorioId }

export interface DocumentoCartera {
  id: string
  /** "F-000123" (factura) / "C-…" (compra, más adelante). */
  numero: string
  /** `YYYY-MM-DD`. */
  fecha: string
  /** `YYYY-MM-DD`. */
  fecha_vencimiento: string
  total_usd: number
  pagado_usd: number
  /** Notas de crédito emitidas sobre el documento. */
  creditos_usd: number
  anulado: boolean
  /**
   * Contraparte, para listados de varias (ej. `/cobros`): cliente o
   * proveedor. Opcional: la ficha de un cliente no la necesita.
   */
  contraparte?: { id: string; nombre: string; detalle?: string | null } | null
  /**
   * Estado ya resuelto en el servidor. Solo cuando el rol no ve montos (los
   * montos llegan en 0); si no, se calcula con `estadoCartera`.
   */
  estado?: EstadoCartera
}

/** Estados con saldo por cobrar/pagar. */
export const ESTADOS_ABIERTOS: readonly EstadoCartera[] = ['vencida', 'por_vencer', 'pendiente']

export interface UltimoRecordatorio {
  fecha: string
  canal: CanalRecordatorioId
}

export interface ResumenCartera {
  conteo: Record<EstadoCartera, number>
  /** `null` si el rol no ve montos. */
  saldo_usd: number | null
  saldo_vencido_usd: number | null
  vencida_mas_antigua_dias: number | null
  ultimo_recordatorio: UltimoRecordatorio | null
  /**
   * Monto por estado (saldo para los abiertos, total para pagadas y
   * anuladas). `null` si el rol no ve montos o si el origen no lo calcula
   * (la vista por cliente del listado solo trae saldos).
   */
  montos_usd?: Record<EstadoCartera, number> | null
}

export type EstadoCartera = 'pagada' | 'pendiente' | 'por_vencer' | 'vencida' | 'anulada'

export interface ConfigCartera {
  /** Días antes del vencimiento en que un documento pasa a "por vencer". */
  diasAviso: number
}
