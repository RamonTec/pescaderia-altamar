'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ProductosTable } from '@/components/organisms/ProductosTable'
import { ProductoForm } from '@/components/organisms/ProductoForm'
import { ConfigNegocioForm } from '@/components/organisms/ConfigNegocioForm'
import { writeUrlParams } from '@/components/organisms/AppDataGrid'
import { useProductoAcciones } from './useProductoAcciones'
import type { Producto, ConfigNegocio } from '@/types/domain'

const TAB_PRODUCTOS = 0
const TAB_CONFIG = 1

function tabDesdeParam(value: string | null, esAdmin: boolean): number {
  return value === 'configuracion' && esAdmin ? TAB_CONFIG : TAB_PRODUCTOS
}

function paramDesdeTab(tab: number): string | null {
  return tab === TAB_CONFIG ? 'configuracion' : null
}

export function CatalogosScreen({
  productos,
  config,
  esAdmin,
}: {
  productos: Producto[]
  config: ConfigNegocio | null
  esAdmin: boolean
}) {
  const searchParams = useSearchParams()
  const tab = tabDesdeParam(searchParams.get('tab'), esAdmin)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Producto | null>(null)

  // El listado se revalida con `revalidatePath`; la ficha no existe.
  const { acciones, estaPendiente } = useProductoAcciones()

  // Como `?pagina=` de AppDataGrid: en la URL sin recargar del servidor.
  const cambiarTab = (_: React.SyntheticEvent, next: number) =>
    writeUrlParams({ tab: paramDesdeTab(next) })

  const handleEdit = (p: Producto) => {
    setEditing(p)
    setOpen(true)
  }

  const handleNew = () => {
    setEditing(null)
    setOpen(true)
  }

  return (
    <>
      {tab === TAB_PRODUCTOS ? (
        <PageHeader
          title="Catálogos"
          subtitle="Productos crudos y procesados que entran por compras y salen por ventas."
          {...(esAdmin
            ? {
                primaryAction: {
                  label: 'Nuevo producto',
                  icon: <AddOutlinedIcon />,
                  onClick: handleNew,
                },
              }
            : {})}
        />
      ) : (
        <PageHeader title="Catálogos" subtitle="Parámetros del negocio." />
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={cambiarTab}>
          <Tab label="Productos" />
          {esAdmin ? <Tab label="Configuración" /> : null}
        </Tabs>
      </Box>

      {tab === TAB_PRODUCTOS || !esAdmin ? (
        <Box sx={{ pb: { xs: 8, sm: 0 } }}>
          <ProductosTable
            productos={productos}
            esAdmin={esAdmin}
            estaPendiente={estaPendiente}
            onNuevo={handleNew}
            onEdit={handleEdit}
            onDesactivar={acciones.desactivar}
            onActivar={acciones.activar}
          />
        </Box>
      ) : (
        <ConfigNegocioForm config={config} />
      )}

      {esAdmin ? (
        <ProductoForm
          key={open ? (editing?.id ?? 'nuevo') : 'cerrado'}
          open={open}
          producto={editing}
          crudos={productos.filter((p) => p.tipo === 'crudo')}
          onClose={() => {
            setOpen(false)
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}