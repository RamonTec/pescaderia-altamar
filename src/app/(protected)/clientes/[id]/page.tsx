import { notFound } from 'next/navigation'
import { ClienteFicha } from './cliente-ficha'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { createClient } from '@/lib/supabase/server'
import { getSaldoPendiente } from '@/lib/services/clienteService'
import { requireAdmin } from '@/lib/services/authService'

export default async function ClienteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await createClient()
  const cliente = await makeClienteRepository(db).getById(id)
  if (!cliente) notFound()

  const [saldo, esAdmin] = await Promise.all([getSaldoPendiente(id), requireAdmin()])

  return (
    <ClienteFicha cliente={cliente} saldo={saldo} esAdmin={esAdmin} />
  )
}
