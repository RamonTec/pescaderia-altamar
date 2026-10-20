import type { SupabaseClient } from '@supabase/supabase-js'
import type { DetalleCompra, ResultadoEdicionCompra, TasaOperacion } from '@/types/domain'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { createClient } from '@/lib/supabase/server'
import { editarCompraSchema } from '@/lib/compraEdicionValidation'
import { entradaTasaDe } from '@/lib/tasaValidation'
import { redondea3, redondea6 } from '@/lib/compras/costo'
import { MSG_TASA_SIN_REFERENCIAL } from '@/lib/validationMessages'
import { requireAdmin } from './authService'
import { resolverTasaOperacion, TasaError } from './tasaService'

/**
 * EdicionCompraService (19): ficha y edición de una compra registrada. Solo
 * admin. Único que usa `ICompraRepository.getDetalle` / `editar`.
 *
 * Editar:
 *   1. Exige admin y valida con `editarCompraSchema`.
 *   2. Proveedor: si cambia, existe y está activo; si la compra queda a
 *      crédito, no bloqueado cuando cambia el proveedor o la condición pasa a
 *      crédito (D4, misma regla que la RPC). Mensaje claro antes de la RPC.
 *   3. Tasa: solo si se pidió cambiarla, con `resolverTasaOperacion` para la
 *      fecha final (referencial recalculada en el servidor o manual). Si no,
 *      `tasa = null` y la RPC conserva las cinco columnas.
 *   4. Llama a la RPC `editar_compra` (atómica, con lock) y traduce sus
 *      `hint` a campos del formulario.
 */

export class EdicionCompraError extends Error {
  constructor(
    message: string,
    /** Ruta del campo en el formulario (`proveedor_id`, `items.0.peso_kg`…). */
    readonly campo?: string
  ) {
    super(message)
    this.name = 'EdicionCompraError'
  }
}

const MSG_SOLO_ADMIN = 'Solo un administrador puede editar compras'

/** `hint` de `editar_compra` → campo del formulario; el resto va al `Alert`. */
const CAMPO_DE_HINT: Record<string, string> = {
  proveedor_invalido: 'proveedor_id',
  proveedor_bloqueado: 'proveedor_id',
  fecha_invalida: 'fecha',
  fecha_posterior_a_salidas: 'fecha',
  motivo_requerido: 'motivo',
}

/** Índice de línea de `detail = 'item:N'`. */
function indiceItem(detail: string | undefined): number | null {
  const m = /^item:(\d+)$/.exec(detail ?? '')
  return m ? Number(m[1]) : null
}

/** Error de la RPC → `EdicionCompraError` con su campo, o el error tal cual. */
export function errorDeEdicion(e: unknown): unknown {
  const pg = (e ?? {}) as { code?: string; hint?: string; message?: string; details?: string }
  if (pg.code === '42501') return new EdicionCompraError(MSG_SOLO_ADMIN)
  const idx = indiceItem(pg.details)
  if (pg.code === 'P0001' && pg.message) {
    if (pg.hint === 'peso_menor_consumido' && idx != null) {
      return new EdicionCompraError(pg.message, `items.${idx}.peso_kg`)
    }
    return new EdicionCompraError(pg.message, pg.hint ? CAMPO_DE_HINT[pg.hint] : undefined)
  }
  if (pg.code === '23514' && pg.message) {
    const campo = idx != null ? `items.${idx}.${/costo/i.test(pg.message) ? 'costo_kg' : 'peso_kg'}` : undefined
    return new EdicionCompraError(pg.message, campo)
  }
  return e
}

/** Ficha `/compras/[id]` (solo admin); `null` si no existe o no es admin. */
export async function getDetalleCompra(id: string, db?: SupabaseClient): Promise<DetalleCompra | null> {
  if (!(await requireAdmin())) return null
  const client = db ?? (await createClient())
  return makeCompraRepository(client).getDetalle(id)
}

export async function editarCompra(
  input: unknown,
  db?: SupabaseClient
): Promise<{ resultado: ResultadoEdicionCompra; aviso?: 'referencial_cambio' }> {
  if (!(await requireAdmin())) throw new EdicionCompraError(MSG_SOLO_ADMIN)

  const safe = editarCompraSchema.safeParse(input)
  if (!safe.success) {
    const issue = safe.error.issues[0]
    const ruta = issue?.path.join('.')
    throw new EdicionCompraError(issue?.message ?? 'Datos inválidos', ruta || undefined)
  }
  const v = safe.data

  const client = db ?? (await createClient())
  const repo = makeCompraRepository(client)

  const compra = await repo.getById(v.compra_id)
  if (!compra) throw new EdicionCompraError('La compra no existe')
  if (compra.estado === 'anulada') throw new EdicionCompraError('La compra está anulada: no se puede editar')

  // Proveedor (D4): mismo criterio que la RPC, con un mensaje claro.
  const cambiaProveedor = v.proveedor_id !== compra.proveedor_id
  const proveedor = await makeProveedorRepository(client).getById(v.proveedor_id)
  if (cambiaProveedor && (!proveedor || !proveedor.activo)) {
    throw new EdicionCompraError('El proveedor no existe o está inactivo', 'proveedor_id')
  }
  if (
    v.condicion === 'credito' &&
    proveedor?.bloqueado &&
    (cambiaProveedor || compra.condicion !== 'credito')
  ) {
    throw new EdicionCompraError(`${proveedor.nombre} está bloqueado: no se permiten compras a crédito`, 'proveedor_id')
  }

  // Tasa: solo si se pidió cambiarla, para la fecha final (08-tasas).
  let tasa: TasaOperacion | null = null
  let aviso: 'referencial_cambio' | undefined
  if (v.cambiar_tasa) {
    try {
      const r = await resolverTasaOperacion(entradaTasaDe(v), v.fecha, client)
      if (r.error === 'sin_referencial' || !r.tasa_operacion) {
        throw new EdicionCompraError(MSG_TASA_SIN_REFERENCIAL, 'tasa')
      }
      tasa = { ...r.tasa_operacion, tasa_snapshot: redondea6(r.tasa_operacion.tasa_snapshot) }
      aviso = r.aviso
    } catch (e) {
      if (e instanceof TasaError) throw new EdicionCompraError(e.message, e.campo)
      throw e
    }
  }

  try {
    const resultado = await repo.editar({
      compra_id: v.compra_id,
      cabecera: {
        proveedor_id: v.proveedor_id,
        fecha: v.fecha,
        condicion: v.condicion,
        moneda: v.moneda,
        notas: v.notas.trim() || null,
        tasa,
      },
      items: v.items.map((i) => ({
        compra_item_id: i.compra_item_id,
        peso_kg: redondea3(i.peso_kg),
        costo_kg_pactado: redondea6(i.costo_kg),
      })),
      motivo: v.motivo,
    })
    return { resultado, aviso }
  } catch (e) {
    throw errorDeEdicion(e)
  }
}
