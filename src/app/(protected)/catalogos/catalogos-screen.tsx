'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ProductosTable } from '@/components/organisms/ProductosTable'
import { ProductoForm } from '@/components/organisms/ProductoForm'
import { ConfigNegocioForm } from '@/components/organisms/ConfigNegocioForm'
import type { Producto, ConfigNegocio } from '@/types/domain'

export function CatalogosScreen({
  productos,
  config,
  esAdmin,
}: {
  productos: Producto[]
  config: ConfigNegocio | null
  esAdmin: boolean
}) {
  const [tab, setTab] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Producto | null>(null)

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
      <PageHeader title="Catálogos">
        {esAdmin ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>
            Nuevo producto
          </Button>
        ) : null}
      </PageHeader>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, next) => setTab(next)}>
          <Tab label="Productos" />
          {esAdmin ? <Tab label="Configuración" /> : null}
        </Tabs>
      </Box>

      {tab === 0 || !esAdmin ? (
        <ProductosTable productos={productos} esAdmin={esAdmin} onEdit={handleEdit} />
      ) : (
        <ConfigNegocioForm config={config} />
      )}

      {esAdmin ? (
        <ProductoForm
          key={open ? (editing?.id ?? 'nuevo') : 'cerrado'}
          open={open}
          producto={editing}
          onClose={() => {
            setOpen(false)
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}
