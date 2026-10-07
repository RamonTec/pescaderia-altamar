'use client'

import * as React from 'react'
import { PageHeader } from '@/components/molecules/PageHeader'
import { FacturasAbiertasTable } from '@/components/organisms/FacturasAbiertasTable'
import { RegistrarPagoDialog } from '@/components/organisms/RegistrarPagoDialog'
import type { FacturaResumen } from '@/lib/repositories/interfaces'

export function CobrosScreen({
  facturas,
  esAdmin,
  tasaDelDia,
}: {
  facturas: FacturaResumen[]
  esAdmin: boolean
  tasaDelDia: number | null
}) {
  const [cobrando, setCobrando] = React.useState<FacturaResumen | null>(null)

  return (
    <>
      <PageHeader title="Cobros y Pagos" />

      <FacturasAbiertasTable
        facturas={facturas}
        esAdmin={esAdmin}
        onPagar={setCobrando}
      />

      {esAdmin ? (
        <RegistrarPagoDialog
          key={cobrando?.id ?? 'cerrado'}
          factura={cobrando}
          tasaDelDia={tasaDelDia}
          onClose={() => setCobrando(null)}
        />
      ) : null}
    </>
  )
}
