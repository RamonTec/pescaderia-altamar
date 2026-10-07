'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getUser, updatePassword } from '@/lib/services/authService'

export interface ActualizarPasswordState {
  error: string | null
  success: string | null
}

export async function actualizarPasswordAction(
  _prev: ActualizarPasswordState,
  formData: FormData
): Promise<ActualizarPasswordState> {
  const user = await getUser()
  if (!user) redirect('/login')

  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres', success: null }
  }
  if (password !== confirm) {
    return { error: 'Las contraseñas no coinciden', success: null }
  }

  const { error } = await updatePassword(password)
  if (error) {
    return { error, success: null }
  }

  revalidatePath('/login')
  return { error: null, success: 'Contraseña actualizada' }
}
