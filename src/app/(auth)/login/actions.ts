'use server'

import { redirect } from 'next/navigation'
import { signIn, signOut } from '@/lib/services/authService'

export interface LoginState {
  error: string | null
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Ingresa email y contraseña' }
  }

  const { error } = await signIn(email, password)
  if (error) {
    return { error }
  }

  redirect('/')
}

export async function signOutAction(): Promise<void> {
  await signOut()
  redirect('/login')
}
