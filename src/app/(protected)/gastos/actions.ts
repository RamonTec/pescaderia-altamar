'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { getSession, requireAdmin } from '@/lib/services/authService'
import {
  GastoError,
  anularGasto,
  descartarGasto,
  editarGasto,
  getGastoDetalle,
  registrarGasto,
} from '@/lib/services/gastoService'
import {
  CategoriaGastoError,
  MSG_SOLO_ADMIN_GASTOS,
  cambiarActivoCategoria,
  guardarCategoria,
} from '@/lib/services/categoriaGastoService'
import { TasaError } from '@/lib/services/tasaService'
import {
  anularGastoSchema,
  descartarGastoSchema,
  editarGastoSchema,
  gastoFormSchema,
} from '@/lib/gastoValidation'
import { activarCategoriaGastoSchema, categoriaGastoSchema } from '@/lib/categoriaGastoValidation'
import { MSG_TASA_REFERENCIAL_CAMBIO } from '@/lib/validationMessages'
import { toActionError, type ActionState } from '@/lib/actionState'
import type { GastoDetalle } from '@/types/domain'

/**
 * Server Actions de gastos (20-gastos): `safeParse` con zod → servicio →
 * `ActionState` + `revalidatePath('/gastos')` y `'/'` (el dashboard suma los
 * gastos en la Fase D). Solo admin (el servicio también lo exige).
 */

function fieldErrorsDeZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) out[path] = issue.message
  }
  return out
}

function errorDeDominio(e: unknown): ActionState {
  if (e instanceof GastoError || e instanceof CategoriaGastoError || e instanceof TasaError) {
    return {
      error: e.message,
      success: null,
      fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
    }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

async function exigirAdmin(): Promise<ActionState | null> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if (!(await requireAdmin())) return { error: MSG_SOLO_ADMIN_GASTOS, success: null }
  return null
}

function revalidar() {
  revalidatePath('/gastos')
  revalidatePath('/')
}

const INVALIDO = 'Revisa los campos marcados'

export async function registrarGastoAction(input: unknown): Promise<ActionState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  const safe = gastoFormSchema.safeParse(input)
  if (!safe.success) return { error: INVALIDO, success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  try {
    const { aviso } = await registrarGasto(safe.data)
    revalidar()
    return {
      error: null,
      success: 'Gasto registrado',
      info: aviso === 'referencial_cambio' ? MSG_TASA_REFERENCIAL_CAMBIO : null,
    }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function editarGastoAction(input: unknown): Promise<ActionState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  const safe = editarGastoSchema.safeParse(input)
  if (!safe.success) return { error: INVALIDO, success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  try {
    await editarGasto(safe.data)
    revalidar()
    return { error: null, success: 'Gasto actualizado' }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function anularGastoAction(input: unknown): Promise<ActionState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  const safe = anularGastoSchema.safeParse(input)
  if (!safe.success) return { error: INVALIDO, success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  try {
    await anularGasto(safe.data)
    revalidar()
    return { error: null, success: 'Gasto anulado' }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function descartarGastoAction(input: unknown): Promise<ActionState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  const safe = descartarGastoSchema.safeParse(input)
  if (!safe.success) return { error: INVALIDO, success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  try {
    await descartarGasto(safe.data)
    revalidar()
    return { error: null, success: 'Gasto descartado' }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export interface DetalleGastoActionState extends ActionState {
  detalle?: GastoDetalle
}

/** Lectura para `GastoDetalleDialog` (trazabilidad con nombres de usuarios). */
export async function detalleGastoAction(id: string): Promise<DetalleGastoActionState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  try {
    const detalle = await getGastoDetalle(id)
    if (!detalle) return { error: 'El gasto no existe', success: null }
    return { error: null, success: null, detalle }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function guardarCategoriaGastoAction(input: unknown): Promise<ActionState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  const safe = categoriaGastoSchema.safeParse(input)
  if (!safe.success) return { error: INVALIDO, success: null, fieldErrors: fieldErrorsDeZod(safe.error) }
  try {
    const categoria = await guardarCategoria(safe.data)
    revalidar()
    return { error: null, success: safe.data.id ? `Categoría ${categoria.nombre} actualizada` : `Categoría ${categoria.nombre} creada` }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function cambiarActivoCategoriaGastoAction(input: unknown): Promise<ActionState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  const safe = activarCategoriaGastoSchema.safeParse(input)
  if (!safe.success) return { error: 'Datos inválidos', success: null }
  try {
    const categoria = await cambiarActivoCategoria(safe.data)
    revalidar()
    return { error: null, success: `Categoría ${categoria.nombre} ${categoria.activo ? 'activada' : 'desactivada'}` }
  } catch (e) {
    return errorDeDominio(e)
  }
}
