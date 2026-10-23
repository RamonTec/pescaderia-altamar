import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase ANÓNIMO sin cookies (21-cotizaciones, P7): solo para la
 * página pública `/c/[token]` y su PDF. No lee ni escribe la sesión del
 * navegador, así que la página pública nunca carga datos de usuario. Con la
 * clave `anon` solo puede ejecutar `cotizacion_publica` (la tabla no tiene
 * permisos para `anon`). Solo servidor.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}
