import { notFound } from 'next/navigation'
import { AppShell } from '@/components/templates/AppShell'
import { ClienteFicha } from './cliente-ficha'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { createClient } from '@/lib/supabase/server'
import { getSaldoPendiente } from '@/lib/services/clienteService'

export default async function ClienteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await createClient()
  const cliente = await makeClienteRepository(db).getById(id)
  if (!cliente) notFound()

  const saldo = await getSaldoPendiente(id)

  return (
    <AppShell>
      <ClienteFicha cliente={cliente} saldo={saldo} />
    </AppShell>
  )
}
