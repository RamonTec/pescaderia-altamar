import { NotasCreditoScreen } from './notas-credito-screen'
import { makeNotaCreditoRepository } from '@/lib/repositories/notaCreditoRepository'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function NotasCreditoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const db = await createClient()
  const params = await searchParams
  const page = Number(params.page) || 1
  const pageSize = Number(params.pageSize) || 50
  const q = params.q as string | undefined
  const estado = params.estado as 'emitida' | 'anulada' | 'todos' | undefined

  const [res, facturas, esAdmin] = await Promise.all([
    makeNotaCreditoRepository(db).list({ page, pageSize, q, estado }),
    makeFacturaRepository(db).list(),
    requireAdmin(),
  ])

  return (
    <NotasCreditoScreen
      notas={res.rows}
      totalNotas={res.total}
      facturas={facturas}
      esAdmin={esAdmin}
    />
  )
}
