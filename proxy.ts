import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    const redirectResponse = NextResponse.redirect(url)

    // Cookies de auth staladas (refresh token muerto/expirado) dejarían a la
    // app en estado "sesión que no valida": se limpian en la propia respuesta
    // de redirección para que el siguiente login arranque limpio.
    request.cookies
      .getAll()
      .filter((c) => c.name.includes('-auth-token'))
      .forEach((c) => redirectResponse.cookies.delete(c.name))

    return redirectResponse
  }

  return response
}

export const config = {
  matcher: [
    '/((?!login|recuperar|actualizar-password|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
