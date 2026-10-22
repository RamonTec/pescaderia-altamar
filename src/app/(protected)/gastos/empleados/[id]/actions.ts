'use server'

import { revalidatePath } from 'next/cache'
import { getSession, requireAdmin } from '@/lib/services/authService'
import { EmpleadoError, cambiarActivoEmpleado, guardarEmpleado } from '@/lib/services/empleadoService'
import { MSG_SOLO_ADMIN_GASTOS } from '@/lib/services/categoriaGastoService'
import { activarEmpleadoSchema, empleadoSchema } from '@/lib/empleadoValidation'
import { toActionError, type ActionState } from '@/lib/actionState'

/**
 * Server Actions de empleados (20-gastos, Fase B): las usan la ficha
 * `/gastos/empleados/[id]` y la pestaña Empleados de `/gastos`. `safeParse`
 * con zod → servicio → `ActionState` + `revalidatePath`. Solo admin (el
 * servicio también lo exige).
 */

export interface GuardarEmpleadoState extends ActionState {
  /** Id del empleado creado o editado. */
  id?: string
}

async function exigirAdmin(): Promise<ActionState | null> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if (!(await requireAdmin())) return { error: MSG_SOLO_ADMIN_GASTOS, success: null }
  return null
}

function revalidar() {
  revalidatePath('/gastos')
  revalidatePath('/gastos/empleados/[id]', 'page')
}

function errorDeDominio(e: unknown): ActionState {
  if (e instanceof EmpleadoError) {
    return { error: e.message, success: null, fieldErrors: e.campo ? { [e.campo]: e.message } : undefined }
  }
  const { error, fieldErrors } = toActionError(e)
  return { error, success: null, fieldErrors }
}

export async function guardarEmpleadoAction(input: unknown): Promise<GuardarEmpleadoState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  const safe = empleadoSchema.safeParse(input)
  if (!safe.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of safe.error.issues) {
      const path = issue.path.join('.')
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message
    }
    return { error: 'Revisa los campos marcados', success: null, fieldErrors }
  }
  try {
    const empleado = await guardarEmpleado(safe.data)
    revalidar()
    return {
      error: null,
      success: safe.data.id ? `${empleado.nombre} actualizado` : `${empleado.nombre} registrado`,
      id: empleado.id,
    }
  } catch (e) {
    return errorDeDominio(e)
  }
}

export async function cambiarActivoEmpleadoAction(input: unknown): Promise<ActionState> {
  const denegado = await exigirAdmin()
  if (denegado) return denegado
  const safe = activarEmpleadoSchema.safeParse(input)
  if (!safe.success) return { error: 'Datos inválidos', success: null }
  try {
    const empleado = await cambiarActivoEmpleado(safe.data)
    revalidar()
    return { error: null, success: `${empleado.nombre} ${empleado.activo ? 'activado' : 'desactivado'}` }
  } catch (e) {
    return errorDeDominio(e)
  }
}
