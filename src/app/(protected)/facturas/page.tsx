import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/molecules/PageHeader'
import { FacturasTable } from '@/components/organisms/FacturasTable'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/services/authService'

/**
 * Todas las facturas emitidas (contado y crédito, cualquier estado). Solo
 * admin, igual que la ficha `/facturas/[id]` a la que enlaza cada fila.
 */
export default async function FacturasPage() {
  if (!(await requireAdmin())) notFound()
  const facturas = await makeFacturaRepository(await createClient()).list()

  return (
    <>
      <PageHeader title="Facturas" subtitle="Todas las facturas emitidas, de contado y de crédito." />
      <FacturasTable facturas={facturas} />
    </>
  )
}
