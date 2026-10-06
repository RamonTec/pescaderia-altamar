'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  getUser,
  updatePassword,
} from '@/lib/services/authService'
import { createClient } from '@/lib/supabase/server'

export interface PerfilState {
  error: string | null
  success: string | null
}

export async function updatePerfilAction(
  _prev: PerfilState,
  formData: FormData
): Promise<PerfilState> {
  const user = await getUser()
  if (!user) redirect('/login')

  const nombre = String(formData.get('nombre') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  const supabase = await createClient()

  if (nombre) {
    const { error } = await supabase
      .from('perfiles')
      .update({ nombre })
      .eq('id', user.id)
    if (error) return { error: 'No se pudo actualizar el nombre', success: null }
  }

  if (password) {
    if (password.length < 6) {
      return { error: 'La contraseña debe tener al menos 6 caracteres', success: null }
    }
    if (password !== confirm) {
      return { error: 'Las contraseñas no coinciden', success: null }
    }
    const { error } = await updatePassword(password)
    if (error) return { error, success: null }
  }

  revalidatePath('/perfil')
  return { error: null, success: 'Cambios guardados' }
}
