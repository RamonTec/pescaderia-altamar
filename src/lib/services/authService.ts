import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function requireAdmin(): Promise<boolean> {
  return (await getRol()) === 'admin'
}

export interface UsuarioRow {
  id: string
  email: string
  nombre: string | null
  rol: Rol
  created_at: string
}

export async function listUsuarios(): Promise<UsuarioRow[]> {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error

  const {
    data: { users },
  } = await supabase.auth.admin.listUsers()

  const emailPorId = new Map(users.map((u) => [u.id, u.email ?? '']))
  return (data ?? []).map((p) => ({
    id: p.id,
    email: emailPorId.get(p.id) ?? '',
    nombre: p.nombre,
    rol: p.rol as Rol,
    created_at: p.created_at,
  }))
}

export interface CreateUserResult {
  error: string | null
}

export async function crearUsuario(
  email: string,
  password: string,
  nombre: string
): Promise<CreateUserResult> {
  const supabase = await createAdminClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  })
  if (error) {
    return { error: error.message || 'No se pudo crear el usuario' }
  }
  if (user) {
    await supabase
      .from('perfiles')
      .update({ nombre })
      .eq('id', user.id)
  }
  return { error: null }
}

export async function resetPasswordForEmail(
  email: string,
  redirectTo: string
): Promise<AuthResult> {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })
  if (error) {
    return { error: 'No se pudo enviar el correo de recuperación' }
  }
  return { error: null }
}

export async function exchangeCodeForSession(code: string): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.exchangeCodeForSession(code)
}
