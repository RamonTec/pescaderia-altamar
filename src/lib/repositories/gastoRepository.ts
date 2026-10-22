import type { SupabaseClient } from '@supabase/supabase-js'
import type { IGastoRepository } from './interfaces'
import type { Gasto, GastoDetalle } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase de los gastos operativos (20-gastos). Escritura
 * directa en `gastos` bajo RLS `es_admin()`; las invariantes (transiciones,
 * `monto_usd`, P1, trazabilidad) las hace cumplir `gastos_guard`. Solo acceso
 * y mapeo `numeric → number`: los errores (con su `hint`) se devuelven tal
 * cual al servicio.
 */

/** Tamaño de página de PostgREST (`max-rows` por defecto de Supabase). */
const LOTE = 1000

const numONull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

function normaliza(fila: Gasto): Gasto {
  return {
    ...fila,
    monto: Number(fila.monto),
    tasa_snapshot: numONull(fila.tasa_snapshot),
    tasa_referencial: numONull(fila.tasa_referencial),
    monto_usd: numONull(fila.monto_usd),
  }
}

export function makeGastoRepository(db: SupabaseClient = createClient()): IGastoRepository {
  async function getById(id: string): Promise<Gasto | null> {
    const { data, error } = await db.from('gastos').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? normaliza(data as Gasto) : null
  }

  async function update(id: string, cambios: Record<string, unknown>): Promise<Gasto> {
    const { data, error } = await db.from('gastos').update(cambios).eq('id', id).select('*').single()
    if (error) throw error
    return normaliza(data as Gasto)
  }

  return {
    async list(filtros) {
      const filas: Gasto[] = []
      for (let desde = 0; ; desde += LOTE) {
        let q = db
          .from('gastos')
          .select('*')
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(desde, desde + LOTE - 1)
        if (filtros.desde) q = q.gte('fecha', filtros.desde)
        if (filtros.hasta) q = q.lte('fecha', filtros.hasta)
        if (filtros.estados?.length) q = q.in('estado', filtros.estados)
        if (filtros.categoriaIds?.length) q = q.in('categoria_id', filtros.categoriaIds)
        if (filtros.empleadoId) q = q.eq('empleado_id', filtros.empleadoId)
        const { data, error } = await q
        if (error) throw error
        const pagina = (data ?? []) as Gasto[]
        filas.push(...pagina.map(normaliza))
        if (pagina.length < LOTE) break
      }
      return filas
    },

    getById,

    async getDetalle(id) {
      const gasto = await getById(id)
      if (!gasto) return null

      const { data: cats, error: errCat } = await db
        .from('categorias_gasto')
        .select('id, nombre, categoria_padre_id')
        .eq('id', gasto.categoria_id)
      if (errCat) throw errCat
      const categoria = (cats?.[0] ?? null) as { nombre: string; categoria_padre_id: string | null } | null
      let padreNombre: string | null = null
      if (categoria?.categoria_padre_id) {
        const { data: padre, error } = await db
          .from('categorias_gasto')
          .select('nombre')
          .eq('id', categoria.categoria_padre_id)
          .maybeSingle()
        if (error) throw error
        padreNombre = (padre as { nombre: string } | null)?.nombre ?? null
      }

      let empleadoNombre: string | null = null
      if (gasto.empleado_id) {
        const { data: emp, error } = await db
          .from('empleados')
          .select('nombre')
          .eq('id', gasto.empleado_id)
          .maybeSingle()
        if (error) throw error
        empleadoNombre = (emp as { nombre: string } | null)?.nombre ?? null
      }

      const ids = [gasto.created_by, gasto.confirmado_por, gasto.anulado_por, gasto.updated_by].filter(
        (v): v is string => Boolean(v)
      )
      const nombres = new Map<string, string | null>()
      if (ids.length > 0) {
        const { data: perfiles, error } = await db.from('perfiles').select('id, nombre').in('id', [...new Set(ids)])
        if (error) throw error
        for (const p of (perfiles ?? []) as { id: string; nombre: string | null }[]) nombres.set(p.id, p.nombre)
      }
      const nombre = (uid: string | null) => (uid ? (nombres.get(uid) ?? null) : null)

      const detalle: GastoDetalle = {
        ...gasto,
        categoria_nombre: categoria?.nombre ?? null,
        categoria_padre_nombre: padreNombre,
        empleado_nombre: empleadoNombre,
        creado_por_nombre: nombre(gasto.created_by),
        confirmado_por_nombre: nombre(gasto.confirmado_por),
        anulado_por_nombre: nombre(gasto.anulado_por),
        actualizado_por_nombre: nombre(gasto.updated_by),
      }
      return detalle
    },

    async create(data) {
      const { data: fila, error } = await db
        .from('gastos')
        .insert({ ...data, estado: 'confirmado' })
        .select('*')
        .single()
      if (error) throw error
      return normaliza(fila as Gasto)
    },

    update: (id, cambios) => update(id, cambios),

    anular: (id, motivo) => update(id, { estado: 'anulado', motivo_anulacion: motivo }),

    descartar: (id, motivo) => update(id, { estado: 'descartado', motivo_anulacion: motivo }),
  }
}
