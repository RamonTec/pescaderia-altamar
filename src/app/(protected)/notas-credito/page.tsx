import { NotasCreditoScreen } from './notas-credito-screen'
import { makeNotaCreditoRepository } from '@/lib/repositories/notaCreditoRepository'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function NotasCreditoPage() {
  const db = await createClient()
  const [notas, facturas, esAdmin] = await Promise.all([
    makeNotaCreditoRepository(db).list(),
    makeFacturaRepository(db).list(),
    requireAdmin(),
  ])

  return (
    <NotasCreditoScreen notas={notas} facturas={facturas} esAdmin={esAdmin} />
  )
}
