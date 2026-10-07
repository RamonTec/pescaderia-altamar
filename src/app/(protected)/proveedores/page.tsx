import { ProveedoresScreen } from './proveedores-screen'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function ProveedoresPage() {
  const db = await createClient()
  const proveedores = await makeProveedorRepository(db).listConResumen()
  const esAdmin = await requireAdmin()

  return (
    <ProveedoresScreen proveedores={proveedores} esAdmin={esAdmin} />
  )
}
