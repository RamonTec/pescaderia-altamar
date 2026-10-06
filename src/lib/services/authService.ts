import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * AuthService (SRP): login, logout y lectura de sesión server-side.
 * Solo consume `lib/supabase/server.ts`; los Server Actions lo invocan
 * y la UI de cliente lee la sesión vía `lib/supabase/client.ts`.
 */

export interface AuthResult {
  error: string | null
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: 'Credenciales inválidas' }
  }
  return { error: null }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  return { error: error ? 'No se pudo actualizar la contraseña' : null }
}

export type Rol = 'admin' | 'operador'

export async function getRol(): Promise<Rol | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (error) return null
  return (data?.rol as Rol) ?? null
}
