import { AppShell } from '@/components/templates/AppShell'
import { CatalogosScreen } from './catalogos-screen'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function CatalogosPage() {
  const db = await createClient()
  const productos = await makeProductoRepository(db).list()
  const config = await makeConfigNegocioRepository(db).get()
  const esAdmin = await requireAdmin()

  return (
    <AppShell>
      <CatalogosScreen productos={productos} config={config} esAdmin={esAdmin} />
    </AppShell>
  )
}
