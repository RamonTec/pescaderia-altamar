'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
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
  const { acciones, dialogos } = useClienteAcciones()

  return (
    <>
      <PageHeader title="Clientes">
        <Button variant="contained" startIcon={<AddIcon />} onClick={acciones.nuevo}>
          Nuevo cliente
        </Button>
      </PageHeader>

      <ClientesTable
        clientes={clientes}
        esAdmin={esAdmin}
        onEdit={acciones.editar}
        onBloquear={acciones.bloquear}
        onDesbloquear={acciones.desbloquear}
        onDesactivar={acciones.desactivar}
        onActivar={acciones.activar}
      />

      {dialogos}
    </>
  )
}
