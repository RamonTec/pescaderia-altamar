'use client'

import * as React from 'react'
import { useTransition } from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ProveedoresTable } from '@/components/organisms/ProveedoresTable'
import { ProveedorForm } from '@/components/organisms/ProveedorForm'
import { BloqueoDialog } from '@/components/organisms/BloqueoDialog'
import type { ProveedorResumen } from '@/lib/repositories/interfaces'
import {
  desactivarProveedorAction,
  activarProveedorAction,
  desbloquearProveedorAction,
  bloquearProveedorAction,
} from './actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export function ProveedoresScreen({
  proveedores,
  esAdmin,
}: {
  proveedores: ProveedorResumen[]
  esAdmin: boolean
}) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProveedorResumen | null>(null)
  const [bloquearTarget, setBloquearTarget] = React.useState<ProveedorResumen | null>(null)
  const [, startTransition] = useTransition()

  const handleEdit = (p: ProveedorResumen) => {
    setEditing(p)
    setOpen(true)
  }

  const handleNew = () => {
    setEditing(null)
    setOpen(true)
  }

  const run = (
    fn: (prev: never, formData: FormData) => Promise<{ error: string | null; success: string | null }>,
    id: string,
    mensajeOk?: string
  ) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('id', id)
      const result = await fn(undefined as never, formData)
      if (result.error) notify.error(result.error)
      else notify.success(mensajeOk ?? result.success ?? 'Listo')
    })
  }

  const handleDesactivar = async (p: ProveedorResumen) => {
    const ok = await confirm({
      title: 'Desactivar proveedor',
      message: `¿Desactivar a "${p.nombre}"? No se podrá usar en nuevas compras.`,
      confirmLabel: 'Desactivar',
      destructive: true,
    })
    if (!ok) return
    run(desactivarProveedorAction as never, p.id)
  }

  const handleActivar = (p: ProveedorResumen) => {
    run(activarProveedorAction as never, p.id)
  }

  const handleDesbloquear = (p: ProveedorResumen) => {
    run(desbloquearProveedorAction as never, p.id)
  }

  const handleBloquear = (p: ProveedorResumen) => {
    setBloquearTarget(p)
  }

  const confirmBloquear = async (motivo: string) => {
    const formData = new FormData()
    formData.set('id', bloquearTarget!.id)
    formData.set('motivo', motivo)
    const result = await bloquearProveedorAction({ error: null, success: null }, formData)
    if (result.error) {
      return { error: result.error, fieldErrors: result.fieldErrors }
    }
    notify.success('Proveedor bloqueado')
    setBloquearTarget(null)
    return { error: null }
  }

  return (
    <>
      <PageHeader title="Proveedores">
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>
          Nuevo proveedor
        </Button>
      </PageHeader>

      <ProveedoresTable
        proveedores={proveedores}
        esAdmin={esAdmin}
        onEdit={handleEdit}
        onBloquear={handleBloquear}
        onDesactivar={handleDesactivar}
        onActivar={handleActivar}
        onDesbloquear={handleDesbloquear}
      />

      <ProveedorForm
        key={open ? (editing?.id ?? 'nuevo') : 'cerrado'}
        open={open}
        proveedor={editing}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
      />

      <BloqueoDialog
        open={!!bloquearTarget}
        titulo={bloquearTarget ? `Bloquear proveedor: ${bloquearTarget.nombre}` : 'Bloquear'}
        onConfirm={confirmBloquear}
        onClose={() => setBloquearTarget(null)}
      />
    </>
  )
}
