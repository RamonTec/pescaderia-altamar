'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ClientesTable } from '@/components/organisms/ClientesTable'
import type { ResumenCartera } from '@/lib/cartera/types'
import type { Cliente } from '@/types/domain'
import { useClienteAcciones } from './useClienteAcciones'

export function ClientesScreen({
  clientes,
  esAdmin,
  cartera,
  diasCreditoDefault,
}: {
  clientes: Cliente[]
  esAdmin: boolean
  cartera: Record<string, ResumenCartera>
  diasCreditoDefault: number
}) {
  const { acciones, dialogos, estaPendiente } = useClienteAcciones({ diasCreditoDefault })

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
          cartera={cartera}
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
