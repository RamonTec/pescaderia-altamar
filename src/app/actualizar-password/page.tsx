import Box from '@mui/material/Box'
import { ActualizarPasswordForm } from '@/components/organisms/ActualizarPasswordForm'
import { exchangeCodeForSession } from '@/lib/services/authService'

export default async function ActualizarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const code = typeof params.code === 'string' ? params.code : null
  if (code) {
    await exchangeCodeForSession(code)
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
      <ActualizarPasswordForm />
    </Box>
  )
}
