import { redirect } from 'next/navigation'
import Box from '@mui/material/Box'
import { LoginForm } from '@/components/organisms/LoginForm'
import { getSession } from '@/lib/services/authService'

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect('/')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <LoginForm />
    </Box>
  )
}
