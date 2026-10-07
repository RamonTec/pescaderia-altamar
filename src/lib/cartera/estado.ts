import type { DocumentoCartera, EstadoCartera } from './types'

/**
 * Estado de cobro/pago de un documento de cartera (09-cuentas-por-cobrar).
 *
 * REGLA DE REFERENCIA: la vista `cartera_clientes_view`
 * (supabase/migrations/20261007170200_cartera_clientes_view.sql) la replica
 * en SQL. Si cambia una, cambiar la otra.
 *
 * Funciones puras: sin I/O ni imports de Supabase/React.
 */

/** Tolerancia de redondeo: un saldo ≤ medio centavo se considera pagado. */
export const TOLERANCIA_SALDO = 0.005

export const ETIQUETA_ESTADO: Record<EstadoCartera, string> = {
  vencida: 'Vencida',
  por_vencer: 'Por vencer',
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  anulada: 'Anulada',
}

/** Orden de gravedad: menor = más grave. */
export const PESO_ESTADO: Record<EstadoCartera, number> = {
  vencida: 0,
  por_vencer: 1,
  pendiente: 2,
  pagada: 3,
  anulada: 4,
}

const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Saldo = total − pagado − créditos (puede ser negativo: saldo a favor). */
export function saldoDocumento(doc: DocumentoCartera): number {
  return redondea6(Number(doc.total_usd) - Number(doc.pagado_usd) - Number(doc.creditos_usd))
}

function aDiaUtc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, (m || 1) - 1, d || 1)
}

/** Días de `hoy` a `fechaVencimiento`: positivo si falta, 0 si vence hoy, negativo si ya venció. */
export function diasHastaVencimiento(fechaVencimiento: string, hoy: string): number {
  return Math.round((aDiaUtc(fechaVencimiento) - aDiaUtc(hoy)) / 86_400_000)
}

/** Suma días a una fecha `YYYY-MM-DD` (para "vence el …" al emitir). */
export function sumarDias(fecha: string, dias: number): string {
  const t = new Date(aDiaUtc(fecha) + dias * 86_400_000)
  return t.toISOString().slice(0, 10)
}

export function estadoCartera(doc: DocumentoCartera, hoy: string, diasAviso: number): EstadoCartera {
  if (doc.anulado) return 'anulada'
  if (saldoDocumento(doc) <= TOLERANCIA_SALDO) return 'pagada'
  const dias = diasHastaVencimiento(doc.fecha_vencimiento, hoy)
  if (dias < 0) return 'vencida'
  if (dias <= diasAviso) return 'por_vencer'
  return 'pendiente'
}

/**
 * Estado ya resuelto por el servidor (`doc.estado`) o calculado con
 * `estadoCartera`. El servidor lo resuelve cuando el rol no ve montos: los
 * montos llegan en 0 y el estado no se podría calcular en el navegador.
 */
export function estadoDe(doc: DocumentoCartera, hoy: string, diasAviso: number): EstadoCartera {
  return doc.estado ?? estadoCartera(doc, hoy, diasAviso)
}

export function estaAbierto(estado: EstadoCartera): boolean {
  return estado === 'vencida' || estado === 'por_vencer' || estado === 'pendiente'
}

/** "Vencida hace 9 días", "Vence hoy", "Vence en 3 días"; `null` si ya no tiene saldo. */
export function textoVencimiento(doc: DocumentoCartera, hoy: string, diasAviso: number): string | null {
  const estado = estadoDe(doc, hoy, diasAviso)
  if (!estaAbierto(estado)) return null
  const dias = diasHastaVencimiento(doc.fecha_vencimiento, hoy)
  if (dias < 0) {
    const n = -dias
    return `Vencida hace ${n} ${n === 1 ? 'día' : 'días'}`
  }
  if (dias === 0) return 'Vence hoy'
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
}

/**
 * Orden por gravedad: vencidas (la más antigua primero), por vencer y
 * pendientes (la que vence antes primero), pagadas (la más reciente
 * primero) y anuladas. No muta el arreglo.
 */
export function ordenarPorGravedad<T extends DocumentoCartera>(
  docs: readonly T[],
  hoy: string,
  diasAviso: number
): T[] {
  const conEstado = docs.map((d) => ({ d, e: estadoDe(d, hoy, diasAviso) }))
  conEstado.sort((a, b) => {
    const pe = PESO_ESTADO[a.e] - PESO_ESTADO[b.e]
    if (pe !== 0) return pe
    if (estaAbierto(a.e)) {
      return a.d.fecha_vencimiento.localeCompare(b.d.fecha_vencimiento)
    }
    return b.d.fecha.localeCompare(a.d.fecha)
  })
  return conEstado.map((x) => x.d)
}
