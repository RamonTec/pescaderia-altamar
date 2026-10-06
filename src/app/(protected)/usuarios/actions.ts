'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin, crearUsuario } from '@/lib/services/authService'

export interface UsuariosState {
  error: string | null
  success: string | null
}

export async function crearUsuarioAction(
  _prev: UsuariosState,
  formData: FormData
): Promise<UsuariosState> {
  if (!(await requireAdmin())) redirect('/login')

  const email = String(formData.get('email') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !nombre || !password) {
    return { error: 'Completa email, nombre y contraseña', success: null }
  }
  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres', success: null }
  }

  const { error } = await crearUsuario(email, password, nombre)
  if (error) {
    return { error, success: null }
  }

  revalidatePath('/usuarios')
  return { error: null, success: `Usuario ${email} creado` }
}
