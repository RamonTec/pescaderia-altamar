import { cache } from 'react'
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
    return { error: 'El email o la contraseña no coinciden. Revísalos e intenta de nuevo.' }
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
  return (await getUsuarioActual())?.rol ?? null
}

export interface UsuarioActual {
  id: string
  email: string
  nombre: string | null
  rol: Rol | null
}

/**
 * Usuario de la sesión + su perfil, en una sola lectura por request
 * (`cache` de React deduplica entre el layout protegido y las páginas).
 * Lo consume `(protected)/layout.tsx` para pasarle sesión y rol a `AppShell`.
 */
export const getUsuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('perfiles')
    .select('nombre, rol')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? '',
    nombre: (data?.nombre as string | null | undefined) ?? null,
    rol: (data?.rol as Rol | undefined) ?? null,
  }
})

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
