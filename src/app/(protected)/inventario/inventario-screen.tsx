'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { PageHeader } from '@/components/molecules/PageHeader'
import { InventarioProductosTable } from '@/components/organisms/InventarioProductosTable'
import { LotesTable } from '@/components/organisms/LotesTable'
import { formatTasaCorta } from '@/lib/format'
import type { InventarioProducto } from '@/lib/services/costingService'
import type { PaginaLotes } from '@/lib/repositories/interfaces'
import type { Producto, Proveedor } from '@/types/domain'
import { listarLotesAction } from './actions'
import { useLoteAcciones } from './useLoteAcciones'

type Pestana = 'productos' | 'lotes'

export interface InventarioScreenProps {
  productos: InventarioProducto[]
  totalUsd: number | null
  totalBs: number | null
  /** Tasa vigente para el valor en Bs (solo admin). */
  tasaBs: number | null
  fuenteTasa: 'bcv' | 'paralela'
  lotesIniciales: PaginaLotes
  /** Productos con control de stock (filtro de la pestaña Lotes). */
  catalogoProductos: Producto[]
  proveedores: Proveedor[]
  diasAlertaLote: number | null
  esAdmin: boolean
  tabInicial: Pestana
}

export function InventarioScreen({
  productos,
  totalUsd,
  totalBs,
  tasaBs,
  fuenteTasa,
  lotesIniciales,
  catalogoProductos,
  proveedores,
  diasAlertaLote,
  esAdmin,
  tabInicial,
}: InventarioScreenProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = React.useState<Pestana>(tabInicial)
  const recargarRef = React.useRef<(() => void) | null>(null)
  const registrarRecarga = React.useCallback((fn: () => void) => {
    recargarRef.current = fn
  }, [])
  // Tras una pérdida o un cierre: la pestaña Productos se refresca sola
  // (`revalidatePath` en la acción); la tabla de lotes vuelve a pedir su página.
  const { acciones, dialogos, estaPendiente } = useLoteAcciones({
    onCambio: () => recargarRef.current?.(),
  })

  const cambiarTab = (siguiente: Pestana) => {
    setTab(siguiente)
    router.replace(siguiente === 'lotes' ? `${pathname}?tab=lotes` : pathname, { scroll: false })
  }

  const enLotes = tab === 'lotes'

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle={
          esAdmin && tasaBs
            ? `Stock por lote · valor en Bs a la tasa ${fuenteTasa === 'bcv' ? 'BCV' : 'paralela'} vigente (${formatTasaCorta(tasaBs)})`
            : 'Stock por lote'
        }
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v: Pestana) => cambiarTab(v)}
          aria-label="Vista del inventario"
        >
          <Tab value="productos" label="Productos" id="tab-productos" aria-controls="panel-productos" />
          <Tab value="lotes" label="Lotes" id="tab-lotes" aria-controls="panel-lotes" />
        </Tabs>
      </Box>

      <Box role="tabpanel" id="panel-productos" aria-labelledby="tab-productos" hidden={enLotes}>
        {!enLotes ? (
          <InventarioProductosTable
            items={productos}
            diasAlertaLote={diasAlertaLote}
            esAdmin={esAdmin}
            totalUsd={totalUsd}
            totalBs={totalBs}
          />
        ) : null}
      </Box>

      <Box role="tabpanel" id="panel-lotes" aria-labelledby="tab-lotes" hidden={!enLotes}>
        {enLotes ? (
          <>
            {diasAlertaLote == null ? (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                Configura en Catálogos los días para marcar un lote como antiguo.
              </Typography>
            ) : null}
            <LotesTable
              inicial={lotesIniciales}
              productos={catalogoProductos}
              proveedores={proveedores}
              diasAlertaLote={diasAlertaLote}
              cargar={listarLotesAction}
              acciones={acciones}
              estaPendiente={estaPendiente}
              registrarRecarga={registrarRecarga}
              onFiltrosChange={() => router.replace(`${pathname}?tab=lotes`, { scroll: false })}
            />
          </>
        ) : null}
      </Box>

      {dialogos}
    </>
  )
}
