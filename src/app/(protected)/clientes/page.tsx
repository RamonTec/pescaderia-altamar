import { AppShell } from '@/components/templates/AppShell'
import { ClientesScreen } from './clientes-screen'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function ClientesPage() {
  const db = await createClient()
  const clientes = await makeClienteRepository(db).list()
  const esAdmin = await requireAdmin()

  return (
    <AppShell>
      <ClientesScreen clientes={clientes} esAdmin={esAdmin} />
    </AppShell>
  )
}
