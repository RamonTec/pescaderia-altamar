import type {
  FuenteReferencia,
  IndicadorLinea,
  LineaTrazabilidad,
  NivelSenal,
  ResumenSenales,
  SenalFactura,
  SenalesLinea,
} from '@/types/domain'
import { formatUsd } from '@/lib/format'
import { redondea6 } from './totales'

/**
 * Señales de posible error de una factura (17, aprobadas el 2026-10-19).
 * Funciones puras: informativas, no bloquean nada.
 *
 * | Señal        | Nivel | Regla (por línea)                                   |
 * | `perdida`    | error | costo > 0 y precio < costo                          |
 * | `por_debajo` | aviso | hay referencia y precio < ref × (1 − t)             |
 * | `cobro_mayor`| aviso | hay referencia y precio > ref × (1 + t)             |
 *
 * `t = tolerancia_precio_ref_pct / 100` (default 0). Todo se compara al
 * centavo: con tolerancia 0, una referencia ponderada de 11,999999 no marca
 * un precio de 12.
 */

export const SENALES: readonly SenalFactura[] = ['perdida', 'por_debajo', 'cobro_mayor']

export const ETIQUETA_SENAL: Record<SenalFactura, string> = {
  perdida: 'Pérdida',
  por_debajo: 'Por debajo',
  cobro_mayor: 'Cobro mayor',
}

export const ETIQUETA_INDICADOR: Record<IndicadorLinea, string> = {
  sin_referencia: 'Sin referencia',
  sin_costo: 'Sin costo',
}

export const NIVEL_DE_SENAL: Record<SenalFactura, Exclude<NivelSenal, 'ok'>> = {
  perdida: 'error',
  por_debajo: 'aviso',
  cobro_mayor: 'aviso',
}

const PESO_NIVEL: Record<NivelSenal, number> = { ok: 0, aviso: 1, error: 2 }

/** Al centavo (2 decimales), con el redondeo de `Math.round`. */
export const alCentavo = (n: number) => Math.round(n * 100) / 100

export interface ReferenciaLinea {
  precio: number | null
  fuente: FuenteReferencia | null
}

/**
 * Precio de referencia de una línea: media de los snapshots
 * `proceso_items.precio_referencia_usd_kg` de sus lotes, ponderada por kg
 * (solo los lotes que tienen snapshot). Sin ningún snapshot, el precio del
 * catálogo; sin catálogo, "sin referencia".
 */
export function precioReferenciaLinea(
  linea: Pick<LineaTrazabilidad, 'lotes' | 'producto'>
): ReferenciaLinea {
  let kg = 0
  let valor = 0
  for (const l of linea.lotes) {
    if (l.origen !== 'proceso') continue
    const ref = l.proceso?.precio_referencia_usd_kg
    if (ref == null || !(l.peso_kg > 0)) continue
    kg += l.peso_kg
    valor += l.peso_kg * ref
  }
  if (kg > 0) return { precio: redondea6(valor / kg), fuente: 'proceso' }
  const catalogo = linea.producto.precio_referencia_usd_kg
  if (catalogo != null) return { precio: Number(catalogo), fuente: 'catalogo' }
  return { precio: null, fuente: null }
}

/** Señales e indicadores de una línea con la tolerancia (%) de `config_negocio`. */
export function senalesLinea(
  linea: Pick<LineaTrazabilidad, 'precio_usd_kg' | 'costo_usd_kg' | 'lotes' | 'producto'>,
  toleranciaPct: number
): SenalesLinea {
  const t = Math.max(0, toleranciaPct) / 100
  const precio = alCentavo(linea.precio_usd_kg)
  const senales: SenalFactura[] = []
  const indicadores: IndicadorLinea[] = []

  if (linea.costo_usd_kg > 0) {
    if (precio < alCentavo(linea.costo_usd_kg)) senales.push('perdida')
  } else {
    indicadores.push('sin_costo')
  }

  const ref = precioReferenciaLinea(linea)
  if (ref.precio == null) {
    indicadores.push('sin_referencia')
  } else {
    if (precio < alCentavo(ref.precio * (1 - t))) senales.push('por_debajo')
    if (precio > alCentavo(ref.precio * (1 + t))) senales.push('cobro_mayor')
  }

  return {
    senales,
    indicadores,
    nivel: peorNivel(senales.map((s) => NIVEL_DE_SENAL[s])),
    precio_referencia_usd_kg: ref.precio,
    fuente_referencia: ref.fuente,
  }
}

export function peorNivel(niveles: readonly NivelSenal[]): NivelSenal {
  return niveles.reduce<NivelSenal>((peor, n) => (PESO_NIVEL[n] > PESO_NIVEL[peor] ? n : peor), 'ok')
}

/** Nivel de la factura (el peor de sus líneas) y conteo por señal. */
export function senalFactura(lineas: readonly Pick<SenalesLinea, 'senales' | 'nivel'>[]): ResumenSenales {
  const conteo: Record<SenalFactura, number> = { perdida: 0, por_debajo: 0, cobro_mayor: 0 }
  for (const l of lineas) for (const s of l.senales) conteo[s]++
  return { nivel: peorNivel(lineas.map((l) => l.nivel)), conteo }
}

/** "1 pérdida · 2 cobro mayor"; cadena vacía sin señales. */
export function textoConteoSenales(conteo: Record<SenalFactura, number>): string {
  return SENALES.filter((s) => conteo[s] > 0)
    .map((s) => `${conteo[s]} ${ETIQUETA_SENAL[s].toLowerCase()}`)
    .join(' · ')
}

export interface DatosExplicacion {
  precio: number
  costo: number
  referencia: number | null
  fuente: FuenteReferencia | null
  toleranciaPct: number
}

/** Texto del tooltip de una señal o indicador: la regla con las cifras de la línea. */
export function explicacionSenal(tipo: SenalFactura | IndicadorLinea, d: DatosExplicacion): string {
  const fuente = d.fuente === 'catalogo' ? 'del catálogo' : 'del procesamiento'
  const tol = d.toleranciaPct > 0 ? ` (tolerancia ${d.toleranciaPct} %)` : ''
  switch (tipo) {
    case 'perdida':
      return `Precio ${formatUsd(d.precio)}/kg por debajo del costo ${formatUsd(d.costo)}/kg`
    case 'por_debajo':
      return `Precio ${formatUsd(d.precio)}/kg por debajo de la referencia ${fuente} ${formatUsd(d.referencia ?? 0)}/kg${tol}`
    case 'cobro_mayor':
      return `Precio ${formatUsd(d.precio)}/kg por encima de la referencia ${fuente} ${formatUsd(d.referencia ?? 0)}/kg${tol}`
    case 'sin_referencia':
      return 'Sin precio de referencia: "Por debajo" y "Cobro mayor" no aplican'
    case 'sin_costo':
      return 'Sin costo de inventario: "Pérdida" no aplica'
  }
}
