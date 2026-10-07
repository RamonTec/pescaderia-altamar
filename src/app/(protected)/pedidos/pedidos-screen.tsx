'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader } from '@/components/molecules/PageHeader'
import { PedidosTable } from '@/components/organisms/PedidosTable'
import { PedidoForm } from '@/components/organisms/PedidoForm'
import { EntregaPedidoDialog } from '@/components/organisms/EntregaPedidoDialog'
import type { PedidoDetalle, PedidoResumen } from '@/lib/repositories/interfaces'
import type { TasaSelectorConfig } from '@/components/organisms/TasaSelector'
import { pedidoRepository } from '@/lib/repositories/pedidoRepository'
import type { Cliente, Producto } from '@/types/domain'
import { anularPedidoAction } from './actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'
import { useTransition } from 'react'

export function PedidosScreen({
  pedidos,
  totalPedidos,
  clientes,
  productos,
  configTasas,
  diasCreditoDefault,
}: {
  pedidos: PedidoResumen[]
  totalPedidos: number
  clientes: Cliente[]
  productos: Producto[]
  configTasas: TasaSelectorConfig
  /** Días de crédito por defecto del negocio (09-cuentas-por-cobrar). */
  diasCreditoDefault: number
}) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [, startTransition] = useTransition()
  const [nuevoAbierto, setNuevoAbierto] = React.useState(false)
  const [entregando, setEntregando] = React.useState<PedidoDetalle | null>(null)

  const entregar = async (pedido: PedidoResumen) => {
    try {
      const detalle = await pedidoRepository.getById(pedido.id)
      if (detalle) setEntregando(detalle)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'No se pudo cargar el pedido')
    }
  }

  const anular = async (pedido: PedidoResumen) => {
    const ok = await confirm({
      title: 'Anular pedido',
      message: 'El pedido quedará anulado y ya no se podrá entregar.',
      confirmLabel: 'Anular',
      destructive: true,
    })
    if (!ok) return

    const formData = new FormData()
    formData.set('id', pedido.id)
    startTransition(async () => {
      const result = await anularPedidoAction({ error: null, success: null }, formData)
      if (result.error) notify.error(result.error)
      else notify.success(result.success ?? 'Pedido anulado')
    })
  }

  return (
    <>
      <PageHeader title="Pedidos / POS">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNuevoAbierto(true)}>
          Nueva venta / pedido
        </Button>
      </PageHeader>

      <PedidosTable
        pedidos={pedidos}
        total={totalPedidos}
        onEntregar={entregar}
        onAnular={anular}
        onNuevo={() => setNuevoAbierto(true)}
      />

      <PedidoForm
        key={nuevoAbierto ? 'form-abierto' : 'form-cerrado'}
        open={nuevoAbierto}
        onClose={() => setNuevoAbierto(false)}
        clientes={clientes}
        productos={productos}
        configTasas={configTasas}
        diasCreditoDefault={diasCreditoDefault}
      />

      <EntregaPedidoDialog
        key={entregando?.id ?? 'entrega-cerrado'}
        pedido={entregando}
        configTasas={configTasas}
        diasCreditoDefault={diasCreditoDefault}
        productos={productos}
        onClose={() => setEntregando(null)}
      />
    </>
  )
}
