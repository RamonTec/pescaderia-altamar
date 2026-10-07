import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/organisms/LoginForm'
import { getUser } from '@/lib/services/authService'

export default async function LoginPage() {
  // `getUser()` (validado contra Supabase) y no `getSession()`: el proxy usa
  // `getUser()`, y una sesión stalada en cookies haría que este redirect a `/`
  // y el redirect del proxy de vuelta a `/login` se persiguieran en loop.
  const user = await getUser()
  if (user) {
    redirect('/')
  }

  return <LoginForm />
}
