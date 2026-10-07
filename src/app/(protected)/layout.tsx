import { redirect } from 'next/navigation'
import { AppShell } from '@/components/templates/AppShell'
import { getUsuarioActual } from '@/lib/services/authService'

/**
 * Shell persistente: el menú y la barra superior viven aquí y no se vuelven a
 * montar al navegar; solo cambia `children` (y su `loading.tsx`). La sesión y
 * el rol se resuelven una vez en el servidor y llegan por props.
 */
export default async function ProtectedLayout({ children }: LayoutProps<'/'>) {
  const usuario = await getUsuarioActual()
  if (!usuario) {
    redirect('/login')
  }

  return (
    <AppShell
      usuario={{ email: usuario.email, nombre: usuario.nombre, rol: usuario.rol }}
    >
      {children}
    </AppShell>
  )
}