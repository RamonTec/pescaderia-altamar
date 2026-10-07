'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ClientesTable } from '@/components/organisms/ClientesTable'
import { ClienteForm } from '@/components/organisms/ClienteForm'
import type { Cliente } from '@/types/domain'

export function ClientesScreen({
  clientes,
  esAdmin,
}: {
  clientes: Cliente[]
  esAdmin: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Cliente | null>(null)

  const handleEdit = (cliente: Cliente) => {
    setEditing(cliente)
    setOpen(true)
  }

  const handleNew = () => {
    setEditing(null)
    setOpen(true)
  }

  return (
    <>
      <PageHeader title="Clientes">
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>
          Nuevo cliente
        </Button>
      </PageHeader>

      <ClientesTable clientes={clientes} esAdmin={esAdmin} onEdit={handleEdit} />

      <ClienteForm
        open={open}
        cliente={editing}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
      />
    </>
  )
}
