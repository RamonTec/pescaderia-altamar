'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession, getRol } from '@/lib/services/authService'
import {
  actualizarTasas,
  getTasaVigente,
  registrarTasaManualDelDia,
  TasaError,
  type ResumenActualizacion,
} from '@/lib/services/tasaService'
import { toActionError, type ActionState } from '@/lib/actionState'

/**
 * Server Actions de tasas (08-tasas Fase D):
 * - `getTasaVigenteAction`: la usa `TasaSelector` con debounce al cambiar
 *   fuente o fecha; devuelve la referencial vigente (o `null` si no hay).
 * - `actualizarTasasAction`: "Actualizar ahora" en `/tasas` (solo admin),
 *   con el resumen por fuente/moneda para el toast.
 * - `registrarTasaManualAction`: `TasaManualDialog` (solo admin).
 */

export interface TasaVigenteActionData {
  /** Valor de la referencial (Bs/USD); null si no hay ninguna disponible. */
  valor: number | null
  fuente: 'bcv' | 'paralela' | null
  /** Fecha valor de la referencial (la vigente puede ser de un día anterior). */
  fecha_valor: string | null
  /** `true` si la fecha valor es anterior a la pedida (fin de semana/feriado). */
  arrastrada: boolean
}

const vigenteSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  fuente: z.enum(['bcv', 'paralela']),
})

export async function getTasaVigenteAction(input: {
  fecha: string
  fuente: 'bcv' | 'paralela'
}): Promise<TasaVigenteActionData> {
  if (!(await getSession())) {
    return { valor: null, fuente: null, fecha_valor: null, arrastrada: false }
  }
  const safe = vigenteSchema.safeParse(input)
  if (!safe.success) {
    return { valor: null, fuente: null, fecha_valor: null, arrastrada: false }
  }
  const vigente = await getTasaVigente(safe.data.fecha, safe.data.fuente, 'USD')
  if (!vigente) return { valor: null, fuente: null, fecha_valor: null, arrastrada: false }
  return {
    valor: Number(vigente.tasa.valor_bs),
    fuente: vigente.tasa.fuente === 'paralela' ? 'paralela' : 'bcv',
    fecha_valor: vigente.fecha_valor,
    arrastrada: vigente.arrastrada,
  }
}

export interface ActualizarTasasState extends ActionState {
  resumen?: ResumenActualizacion
}

export async function actualizarTasasAction(): Promise<ActualizarTasasState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if ((await getRol()) !== 'admin') {
    return { error: 'Solo un administrador puede actualizar las tasas', success: null }
  }

  try {
    const resumen = await actualizarTasas({ forzar: true })
    revalidatePath('/tasas')
    return { error: null, success: 'Tasas actualizadas', resumen }
  } catch (e) {
    return { error: toActionError(e).error, success: null }
  }
}

const tasaManualSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha valor inválida'),
  fuente: z.enum(['bcv', 'paralela']),
  moneda: z.enum(['USD', 'EUR']),
  valor: z.number().positive('La tasa debe ser mayor a 0'),
})

export async function registrarTasaManualAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await getSession())) return { error: 'Sin sesión', success: null }
  if ((await getRol()) !== 'admin') {
    return { error: 'Solo un administrador puede registrar tasas manuales', success: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(String(formData.get('payload') ?? ''))
  } catch {
    return { error: 'Datos inválidos', success: null }
  }

  const safe = tasaManualSchema.safeParse(parsed)
  if (!safe.success) {
    const out: Record<string, string> = {}
    for (const issue of safe.error.issues) {
      const path = issue.path.join('.')
      if (path && !out[path]) out[path] = issue.message
    }
    return { error: 'Revisa los campos marcados', success: null, fieldErrors: out }
  }

  try {
    await registrarTasaManualDelDia(safe.data)
    revalidatePath('/tasas')
    return { error: null, success: 'Tasa manual registrada' }
  } catch (e) {
    if (e instanceof TasaError) {
      return {
        error: e.message,
        success: null,
        fieldErrors: e.campo ? { [e.campo]: e.message } : undefined,
      }
    }
    return { error: toActionError(e).error, success: null }
  }
}