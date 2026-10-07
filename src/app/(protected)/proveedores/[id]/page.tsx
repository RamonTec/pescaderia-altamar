import { notFound } from 'next/navigation'
import { AppShell } from '@/components/templates/AppShell'
import { ProveedorFicha } from './proveedor-ficha'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { createClient } from '@/lib/supabase/server'
import { getSaldoPendiente } from '@/lib/services/proveedorService'
import { requireAdmin } from '@/lib/services/authService'

export default async function ProveedorFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await createClient()
  const proveedor = await makeProveedorRepository(db).getById(id)
  if (!proveedor) notFound()

  const saldo = await getSaldoPendiente(id)
  const esAdmin = await requireAdmin()

  return (
    <AppShell>
      <ProveedorFicha proveedor={proveedor} saldo={saldo} esAdmin={esAdmin} />
    </AppShell>
  )
}
