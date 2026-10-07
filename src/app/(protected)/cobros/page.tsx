import { AppShell } from '@/components/templates/AppShell'
import { CobrosScreen } from './cobros-screen'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { getConfigTasas } from '@/lib/services/tasaService'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

export default async function CobrosPage() {
  const db = await createClient()
  const [facturas, configTasas, esAdmin] = await Promise.all([
    makeFacturaRepository(db).list('abierta'),
    // 08-tasas Fase D: fuente default + umbral de desviación para el
    // `TasaSelector` del abono.
    getConfigTasas(db),
    requireAdmin(),
  ])

  return (
    <AppShell>
      <CobrosScreen facturas={facturas} esAdmin={esAdmin} configTasas={configTasas} />
    </AppShell>
  )
}
