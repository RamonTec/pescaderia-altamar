'use client'

import { PageHeader } from '@/components/molecules/PageHeader'
import { ContratosTable } from '@/components/organisms/ContratosTable'
import type { FiltrosContratos } from '@/lib/contratoValidation'
import type { ContratoListado } from '@/types/domain'

export function ContratosScreen({
  contratos,
  total,
  filtros,
}: {
  contratos: ContratoListado[]
  total: number
  filtros: FiltrosContratos
}) {
  return (
    <>
      <PageHeader title="Contratos" subtitle="Se generan desde el menú ⋮ de una factura o compra a crédito" />
      <ContratosTable contratos={contratos} total={total} filtros={filtros} />
    </>
  )
}
