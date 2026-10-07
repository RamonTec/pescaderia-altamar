'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader } from '@/components/molecules/PageHeader'
import { NotasCreditoTable } from '@/components/organisms/NotasCreditoTable'
import { NotaCreditoForm } from '@/components/organisms/NotaCreditoForm'
import type { FacturaResumen, NotaCreditoResumen } from '@/lib/repositories/interfaces'
import { anularNotaCreditoAction } from './actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'
import { useTransition } from 'react'

export function NotasCreditoScreen({
  notas,
  facturas,
  esAdmin,
}: {
  notas: NotaCreditoResumen[]
  facturas: FacturaResumen[]
  esAdmin: boolean
}) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [, startTransition] = useTransition()
  const [nuevaAbierta, setNuevaAbierta] = React.useState(false)

  const anular = async (nota: NotaCreditoResumen) => {
    const ok = await confirm({
      title: 'Anular nota de crédito',
      message: `La nota N.º ${nota.numero} quedará anulada y su efecto en el saldo (y en inventario, si aplica) se revertirá.`,
      confirmLabel: 'Anular',
      destructive: true,
    })
    if (!ok) return

    const formData = new FormData()
    formData.set('id', nota.id)
    startTransition(async () => {
      const result = await anularNotaCreditoAction({ error: null, success: null }, formData)
      if (result.error) notify.error(result.error)
      else notify.success(result.success ?? 'Nota anulada')
    })
  }

  return (
    <>
      <PageHeader title="Notas de crédito">
        {esAdmin ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNuevaAbierta(true)}>
            Emitir nota
          </Button>
        ) : null}
      </PageHeader>

      <NotasCreditoTable notas={notas} esAdmin={esAdmin} onAnular={anular} />

      {esAdmin ? (
        <NotaCreditoForm
          key={nuevaAbierta ? 'abierta' : 'cerrada'}
          open={nuevaAbierta}
          onClose={() => setNuevaAbierta(false)}
          facturas={facturas}
        />
      ) : null}
    </>
  )
}
