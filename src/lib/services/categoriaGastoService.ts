import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoriaGasto } from '@/types/domain'
import type { ICategoriaGastoRepository } from '@/lib/repositories/interfaces'
import { makeCategoriaGastoRepository } from '@/lib/repositories/categoriaGastoRepository'
import { createClient } from '@/lib/supabase/server'
import type { ActivarCategoriaGastoValues, CategoriaGastoFormValues } from '@/lib/categoriaGastoValidation'
import { requireAdmin } from './authService'

/**
 * CategoriaGastoService (20-gastos): catálogo de categorías de gasto con
 * subcategoría opcional (un nivel). Solo admin en cada función. Las de
 * sistema (Nómina) no se renombran, desactivan ni reciben subcategorías:
 * el servicio lo comprueba para dar el mensaje en su campo y la base lo hace
 * cumplir igual (`categorias_gasto_guard`).
 */

export const MSG_SOLO_ADMIN_GASTOS = 'Solo un administrador puede gestionar los gastos'

/** Error de regla de negocio; `campo` permite marcarlo en el formulario. */
export class CategoriaGastoError extends Error {
  constructor(
    message: string,
    readonly campo?: 'nombre' | 'categoria_padre_id' | 'orden'
  ) {
    super(message)
    this.name = 'CategoriaGastoError'
  }
}

interface PgErrorLike {
  code?: string
  hint?: string
  message?: string
}

const CAMPO_POR_HINT: Record<string, CategoriaGastoError['campo']> = {
  categoria_sistema: undefined,
  categoria_nivel: 'categoria_padre_id',
  categoria_nomina_sin_sub: 'categoria_padre_id',
}

/** Traduce los `hint` de `categorias_gasto_guard` y el `23505` del nombre a errores con campo. */
function traducir(e: unknown): never {
  const pg = (e ?? {}) as PgErrorLike
  if (pg.code === '23505') {
    throw new CategoriaGastoError('Ya existe una categoría con ese nombre en el mismo nivel', 'nombre')
  }
  if (pg.code === 'P0001' && pg.hint && pg.hint in CAMPO_POR_HINT) {
    throw new CategoriaGastoError(pg.message ?? 'Operación no permitida', CAMPO_POR_HINT[pg.hint])
  }
  throw e
}

async function contexto(): Promise<{ db: SupabaseClient; categorias: ICategoriaGastoRepository }> {
  if (!(await requireAdmin())) throw new CategoriaGastoError(MSG_SOLO_ADMIN_GASTOS)
  const db = await createClient()
  return { db, categorias: makeCategoriaGastoRepository(db) }
}

/**
 * Agrupa la lista plana: categorías de primer nivel (por `orden`, `nombre`)
 * con sus subcategorías en `subcategorias`. Función pura.
 */
export function agruparCategorias(planas: readonly CategoriaGasto[]): CategoriaGasto[] {
  const porOrden = [...planas].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
  const raices = porOrden.filter((c) => c.categoria_padre_id === null).map((c) => ({ ...c, subcategorias: [] as CategoriaGasto[] }))
  const porId = new Map(raices.map((c) => [c.id, c]))
  for (const c of porOrden) {
    if (c.categoria_padre_id) porId.get(c.categoria_padre_id)?.subcategorias.push(c)
  }
  return raices
}

/** Catálogo agrupado (activas e inactivas). */
export async function listarCategorias(): Promise<CategoriaGasto[]> {
  const { categorias } = await contexto()
  return agruparCategorias(await categorias.list())
}

async function validarPadre(repo: ICategoriaGastoRepository, padreId: string | null, propioId?: string) {
  if (!padreId) return
  const todas = await repo.list()
  const padre = todas.find((c) => c.id === padreId)
  if (!padre) throw new CategoriaGastoError('La categoría padre no existe', 'categoria_padre_id')
  if (padre.clave === 'nomina') {
    throw new CategoriaGastoError('Nómina no admite subcategorías', 'categoria_padre_id')
  }
  if (padre.categoria_padre_id !== null || padre.id === propioId) {
    throw new CategoriaGastoError('Elige una categoría de primer nivel', 'categoria_padre_id')
  }
  if (propioId && todas.some((c) => c.categoria_padre_id === propioId)) {
    throw new CategoriaGastoError('Una categoría con subcategorías no puede ser subcategoría', 'categoria_padre_id')
  }
}

/** Crea (sin `id`) o actualiza nombre, padre y orden. */
export async function guardarCategoria(v: CategoriaGastoFormValues): Promise<CategoriaGasto> {
  const { categorias } = await contexto()
  const padreId = v.categoria_padre_id || null
  try {
    if (!v.id) {
      await validarPadre(categorias, padreId)
      return await categorias.create({ nombre: v.nombre, categoria_padre_id: padreId, orden: v.orden })
    }
    const actual = (await categorias.list()).find((c) => c.id === v.id)
    if (!actual) throw new CategoriaGastoError('La categoría no existe')
    if (actual.es_sistema) {
      if (v.nombre !== actual.nombre) {
        throw new CategoriaGastoError(`${actual.nombre} es una categoría de sistema: no se renombra`, 'nombre')
      }
      if (padreId !== actual.categoria_padre_id) {
        throw new CategoriaGastoError(`${actual.nombre} es una categoría de sistema`, 'categoria_padre_id')
      }
      return await categorias.update(v.id, { orden: v.orden })
    }
    await validarPadre(categorias, padreId, v.id)
    return await categorias.update(v.id, { nombre: v.nombre, categoria_padre_id: padreId, orden: v.orden })
  } catch (e) {
    if (e instanceof CategoriaGastoError) throw e
    traducir(e)
  }
}

/** Desactivar oculta la categoría (y sus subcategorías) en los selectores; conserva sus gastos. */
export async function cambiarActivoCategoria(v: ActivarCategoriaGastoValues): Promise<CategoriaGasto> {
  const { categorias } = await contexto()
  const actual = (await categorias.list()).find((c) => c.id === v.id)
  if (!actual) throw new CategoriaGastoError('La categoría no existe')
  if (actual.es_sistema) {
    throw new CategoriaGastoError(`${actual.nombre} es una categoría de sistema: no se desactiva`)
  }
  try {
    return await categorias.update(v.id, { activo: v.activo })
  } catch (e) {
    traducir(e)
  }
}
