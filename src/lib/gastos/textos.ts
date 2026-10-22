import type { CategoriaGasto, EstadoGasto, Gasto } from '@/types/domain'
import { formatTasa } from '@/lib/format'

/** Textos de gastos (20). Puro: sin React. */

export const ETIQUETA_ESTADO_GASTO: Record<EstadoGasto, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  descartado: 'Descartado',
  anulado: 'Anulado',
}

const FUENTE = { bcv: 'BCV', paralela: 'Paralela' } as const

/** Tasa con su procedencia: «36,50 · BCV» (referencial) o «40,00 · manual». */
export function textoTasaGasto(g: Pick<Gasto, 'tasa_snapshot' | 'tasa_origen' | 'tasa_fuente'>): string {
  if (g.tasa_snapshot === null) return '—'
  const valor = formatTasa(g.tasa_snapshot)
  if (g.tasa_origen === 'manual') return `${valor} · manual`
  return g.tasa_fuente ? `${valor} · ${FUENTE[g.tasa_fuente]}` : valor
}

/** «Mantenimiento › Cava» o «Mantenimiento». */
export function rutaCategoria(categorias: ReadonlyMap<string, CategoriaGasto>, id: string): string {
  const cat = categorias.get(id)
  if (!cat) return '—'
  const padre = cat.categoria_padre_id ? categorias.get(cat.categoria_padre_id) : undefined
  return padre ? `${padre.nombre} › ${cat.nombre}` : cat.nombre
}

/** Mapa plano id → categoría a partir del árbol agrupado. */
export function mapaCategorias(arbol: readonly CategoriaGasto[]): Map<string, CategoriaGasto> {
  const mapa = new Map<string, CategoriaGasto>()
  for (const c of arbol) {
    mapa.set(c.id, c)
    for (const s of c.subcategorias ?? []) mapa.set(s.id, s)
  }
  return mapa
}
