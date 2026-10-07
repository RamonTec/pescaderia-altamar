'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ClientesTable } from '@/components/organisms/ClientesTable'
import type { Cliente } from '@/types/domain'
import { useClienteAcciones } from './useClienteAcciones'

export function ClientesScreen({
  clientes,
  esAdmin,
}: {
  clientes: Cliente[]
  esAdmin: boolean
}) {
  const { acciones, dialogos, estaPendiente } = useClienteAcciones()

  return (
    <>
      <PageHeader
        title="Clientes"
        primaryAction={{
          label: 'Nuevo cliente',
          icon: <AddOutlinedIcon />,
          onClick: acciones.nuevo,
        }}
      />

      {/* xs: espacio para que el Fab "Nuevo cliente" no tape la última tarjeta. */}
      <Box sx={{ pb: { xs: 10, sm: 0 } }}>
        <ClientesTable
          clientes={clientes}
          esAdmin={esAdmin}
          estaPendiente={estaPendiente}
          onNuevo={acciones.nuevo}
          onEdit={acciones.editar}
          onBloquear={acciones.bloquear}
          onDesbloquear={acciones.desbloquear}
          onDesactivar={acciones.desactivar}
          onActivar={acciones.activar}
        />
      </Box>

      {dialogos}
    </>
  )
}
