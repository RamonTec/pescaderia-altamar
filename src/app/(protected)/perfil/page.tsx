import { redirect } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppShell } from '@/components/templates/AppShell'
import { PerfilForm } from '@/components/organisms/PerfilForm'
import { getUser } from '@/lib/services/authService'
import { createClient } from '@/lib/supabase/server'

export default async function PerfilPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre')
    .eq('id', user.id)
    .single()

  return (
    <AppShell>
      <Typography variant="h4" gutterBottom>
        Perfil
      </Typography>
      <Box sx={{ maxWidth: 480, mt: 2 }}>
        <PerfilForm email={user.email ?? ''} nombre={perfil?.nombre ?? null} />
      </Box>
    </AppShell>
  )
}
