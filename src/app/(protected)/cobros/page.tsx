import { AppShell } from '@/components/templates/AppShell'
import { CobrosScreen } from './cobros-screen'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { getTasaSugerida } from '@/lib/services/compraService'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function CobrosPage() {
  const db = await createClient()
  const [facturas, tasaSugerida, esAdmin] = await Promise.all([
    makeFacturaRepository(db).list('abierta'),
    getTasaSugerida(db),
    requireAdmin(),
  ])

  return (
    <AppShell>
      <CobrosScreen
        facturas={facturas}
        esAdmin={esAdmin}
        tasaDelDia={tasaSugerida?.bs_por_usd ?? null}
      />
    </AppShell>
  )
}
