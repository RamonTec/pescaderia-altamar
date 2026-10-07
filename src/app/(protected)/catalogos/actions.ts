'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession, getRol } from '@/lib/services/authService'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { createClient } from '@/lib/supabase/server'
import { productoFormSchema } from '@/lib/productoValidation'
import { configFormSchema, formatearTelefonoVe } from '@/lib/configValidation'
import { toActionError, type ActionState } from '@/lib/actionState'

const MAPA_CAMPOS = { codigo: 'codigo' }

async function requireAuth(): Promise<boolean> {
  return !!(await getSession())
}

async function requireAdmin(): Promise<boolean> {
  return (await getRol()) === 'admin'
}

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

export interface UpsertProductoState extends ActionState {
  id?: string | null
}

/** Estado de las acciones de fila (desactivar/activar), como `ClienteActionState`. */
export interface ProductoActionState {
  error: string | null
  success: string | null
}

export async function upsertProductoAction(
  _prev: UpsertProductoState,
  formData: FormData
): Promise<UpsertProductoState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  if (!(await requireAdmin())) {
    return { error: 'Solo un administrador puede crear o editar productos', success: null }
  }

  const id = (formData.get('id') as string) || null
  const raw = String(formData.get('payload') ?? '')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Datos inválidos', success: null }
  }

  const safe = productoFormSchema.safeParse(parsed)
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }

  const input = safe.data
  const codigo = input.codigo.trim() ? input.codigo.trim().toUpperCase() : null
  const categoria = input.categoria.trim() ? input.categoria.trim() : null
  const productoOrigenId = input.tipo === 'procesado' ? input.producto_origen_id : null

  const db = await createClient()
  const repo = makeProductoRepository(db)

  try {
    if (id) {
      await repo.update(id, {
        nombre: input.nombre,
        tipo: input.tipo,
        codigo,
        categoria,
        controla_stock: input.controla_stock,
        producto_origen_id: productoOrigenId,
      })
    } else {
      const creado = await repo.create({
        nombre: input.nombre,
        tipo: input.tipo,
        codigo,
        categoria,
        controla_stock: input.controla_stock,
        activo: true,
        producto_origen_id: productoOrigenId,
      })
      revalidatePath('/catalogos')
      revalidatePath('/procesamiento')
      return { error: null, success: 'Producto creado', id: creado.id }
    }
  } catch (e) {
    // Reglas del trigger `productos_guard_origen` (0014).
    const pg = e as { code?: string; hint?: string; message?: string }
    if (pg.code === 'P0001' && pg.message) {
      const campo = pg.hint === 'crudo_con_procesados' ? 'tipo' : 'producto_origen_id'
      return { error: pg.message, success: null, fieldErrors: { [campo]: pg.message } }
    }
    const { error, fieldErrors } = toActionError(e, { mapaCampos: MAPA_CAMPOS })
    return { error, success: null, fieldErrors }
  }

  revalidatePath('/catalogos')
  revalidatePath('/procesamiento')
  return { error: null, success: 'Producto actualizado', id }
}

export async function desactivarProductoAction(
  _prev: ProductoActionState,
  formData: FormData
): Promise<ProductoActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  if (!(await requireAdmin())) {
    return { error: 'Solo un administrador puede desactivar productos', success: null }
  }
  const parsed = z.string().uuid().safeParse(formData.get('id'))
  if (!parsed.success) return { error: 'Id inválido', success: null }
  const db = await createClient()
  try {
    await makeProductoRepository(db).update(parsed.data, { activo: false })
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/catalogos')
  return { error: null, success: 'Producto desactivado' }
}

export async function activarProductoAction(
  _prev: ProductoActionState,
  formData: FormData
): Promise<ProductoActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  if (!(await requireAdmin())) {
    return { error: 'Solo un administrador puede activar productos', success: null }
  }
  const parsed = z.string().uuid().safeParse(formData.get('id'))
  if (!parsed.success) return { error: 'Id inválido', success: null }
  const db = await createClient()
  try {
    await makeProductoRepository(db).update(parsed.data, { activo: true })
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
  revalidatePath('/catalogos')
  return { error: null, success: 'Producto activado' }
}

export async function updateConfigAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await requireAuth())) return { error: 'Sin sesión', success: null }
  if (!(await requireAdmin())) {
    return { error: 'Solo un administrador puede editar la configuración', success: null }
  }

  const raw = String(formData.get('payload') ?? '')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Datos inválidos', success: null }
  }

  const safe = configFormSchema.safeParse(parsed)
  if (!safe.success) {
    return {
      error: 'Revisa los campos marcados',
      success: null,
      fieldErrors: fieldErrorsDeZod(safe.error),
    }
  }

  const db = await createClient()
  try {
    await makeConfigNegocioRepository(db).update({
      iva_pct: safe.data.iva_pct,
      fuente_tasa_default: safe.data.fuente_tasa_default,
      umbral_stock_bajo_kg: safe.data.umbral_stock_bajo_kg,
      dias_alerta_lote: safe.data.dias_alerta_lote,
      umbral_desviacion_tasa_pct: safe.data.umbral_desviacion_tasa_pct,
      dias_credito_default: safe.data.dias_credito_default,
      dias_aviso_por_vencer: safe.data.dias_aviso_por_vencer,
      nombre_comercial: safe.data.nombre_comercial,
      email_respuesta: safe.data.email_respuesta || null,
      instrucciones_pago: safe.data.instrucciones_pago.trim() || null,
      // 06-contratos: datos del negocio para el encabezado de los contratos.
      razon_social: safe.data.razon_social || null,
      rif: safe.data.rif || null,
      direccion: safe.data.direccion || null,
      telefono: safe.data.telefono ? formatearTelefonoVe(safe.data.telefono) : null,
    })
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }

  revalidatePath('/catalogos')
  revalidatePath('/clientes', 'layout')
  revalidatePath('/cobros')
  revalidatePath('/inventario', 'layout')
  revalidatePath('/contratos')
  return { error: null, success: 'Configuración guardada' }
}
