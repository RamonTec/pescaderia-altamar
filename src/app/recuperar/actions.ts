'use server'

import { resetPasswordForEmail } from '@/lib/services/authService'

export interface RecuperarState {
  error: string | null
  success: string | null
}

export async function recuperarAction(
  _prev: RecuperarState,
  formData: FormData
): Promise<RecuperarState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) {
    return { error: 'Ingresa tu email', success: null }
  }

  const { error } = await resetPasswordForEmail(
    email,
    `${process.env.SITE_URL ?? 'http://localhost:3000'}/actualizar-password`
  )
  if (error) {
    return { error, success: null }
  }

  return {
    error: null,
    success: 'Si el email existe, recibirás un enlace para restablecer tu contraseña',
  }
}
