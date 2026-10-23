'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/lib/actionState'
import { toActionError } from '@/lib/actionState'
import {
  CotizacionError,
  crearEnlace,
  regenerarEnlace,
  revocarEnlace,
} from '@/lib/services/cotizacionService'

/** Server Actions del enlace público de una cotización (21, Fase C). */

type Operacion = 'crear' | 'regenerar' | 'revocar'

const EXITO: Record<Operacion, string> = {
  crear: 'Enlace creado',
  regenerar: 'Enlace regenerado: el anterior ya no funciona',
  revocar: 'Enlace revocado',
}

export async function enlaceCotizacionAction(id: string, operacion: Operacion): Promise<ActionState> {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Cotización inválida', success: null }
  try {
    if (operacion === 'crear') await crearEnlace(id)
    else if (operacion === 'regenerar') await regenerarEnlace(id)
    else await revocarEnlace(id)
    revalidatePath(`/cotizaciones/${id}`)
    revalidatePath('/cotizaciones')
    return { error: null, success: EXITO[operacion] }
  } catch (e) {
    if (e instanceof CotizacionError) return { error: e.message, success: null }
    return { error: toActionError(e).error, success: null }
  }
}
