'use client'

import * as React from 'react'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { PageHeader } from '@/components/molecules/PageHeader'
import {
  CotizacionesTable,
  type ManejadoresAccionCotizacion,
} from '@/components/organisms/CotizacionesTable'
import type { FiltrosCotizacionesUrl } from '@/lib/cotizacionValidation'
import type { CatalogoCotizacion } from '@/lib/services/cotizacionService'
import type { CotizacionListado } from '@/types/domain'
import { useCotizacionAcciones } from './useCotizacionAcciones'

const resumen = (row: CotizacionListado) => ({
  id: row.id,
  numero: row.numero,
  cliente: row.cliente,
  total_usd: row.total_usd,
})

export function CotizacionesScreen({
  cotizaciones,
  total,
  filtros,
  catalogo,
  hoy,
}: {
  cotizaciones: CotizacionListado[]
  total: number
  filtros: FiltrosCotizacionesUrl
  catalogo: CatalogoCotizacion
  hoy: string
}) {
  const { abrirFormulario, anular, cargandoId, dialogos } = useCotizacionAcciones(catalogo, hoy)
  const nueva = React.useCallback(() => void abrirFormulario('crear', null), [abrirFormulario])

  const acciones = React.useMemo<ManejadoresAccionCotizacion>(
    () => ({
      editar: (row) => void abrirFormulario('editar', row.id),
      renovar: (row) => void abrirFormulario('renovar', row.id),
      duplicar: (row) => void abrirFormulario('duplicar', row.id),
      anular: (row) => anular(resumen(row)),
    }),
    [abrirFormulario, anular]
  )

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        subtitle="Precios en USD por kg para compartir con el cliente. No mueven inventario ni generan deuda."
        primaryAction={{ label: 'Nueva cotización', icon: <AddOutlinedIcon />, onClick: nueva }}
      />
      <CotizacionesTable
        cotizaciones={cotizaciones}
        total={total}
        filtros={filtros}
        hoy={hoy}
        acciones={acciones}
        onNueva={nueva}
        pendienteId={cargandoId}
      />
      {dialogos}
    </>
  )
}
