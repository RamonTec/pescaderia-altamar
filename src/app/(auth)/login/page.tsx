import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/organisms/LoginForm'
import { getSession } from '@/lib/services/authService'

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect('/')
  }

  return <LoginForm />
}
