'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { BloqueoDialog } from '@/components/organisms/BloqueoDialog'
import { ClienteForm } from '@/components/organisms/ClienteForm'
import type { Cliente } from '@/types/domain'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'
import {
  activarClienteAction,
  bloquearClienteAction,
  desactivarClienteAction,
  desbloquearClienteAction,
  type ClienteActionState,
} from './actions'

type ClienteAction = (prev: ClienteActionState, formData: FormData) => Promise<ClienteActionState>

/**
 * Acciones sobre un cliente compartidas por el listado y la ficha: alta/edición
 * (ClienteForm), bloqueo con motivo (BloqueoDialog), desbloqueo y
 * activar/desactivar con confirmación. `dialogos` debe renderizarse una vez.
 *
 * `onCambio` se llama tras cada acción exitosa (la ficha lo usa para
 * `router.refresh()`; el listado ya se revalida con `revalidatePath`).
 */
export function useClienteAcciones({ onCambio }: { onCambio?: () => void } = {}) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editando, setEditando] = React.useState<Cliente | null>(null)
  const [bloqueando, setBloqueando] = React.useState<Cliente | null>(null)

  const run = (fn: ClienteAction, cliente: Cliente) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('id', cliente.id)
      const result = await fn({ error: null, success: null }, formData)
      if (result.error) {
        notify.error(result.error)
        return
      }
      notify.success(result.success ?? 'Listo')
      onCambio?.()
    })
  }

  const confirmarBloqueo = async (motivo: string) => {
    if (!bloqueando) return { error: null }
    const formData = new FormData()
    formData.set('id', bloqueando.id)
    formData.set('motivo', motivo)
    const result = await bloquearClienteAction({ error: null, success: null }, formData)
    if (result.error) return { error: result.error }
    notify.success(result.success ?? 'Cliente bloqueado')
    setBloqueando(null)
    onCambio?.()
    return { error: null }
  }

  const acciones = {
    nuevo: () => {
      setEditando(null)
      setFormOpen(true)
    },
    editar: (cliente: Cliente) => {
      setEditando(cliente)
      setFormOpen(true)
    },
    bloquear: (cliente: Cliente) => setBloqueando(cliente),
    desbloquear: (cliente: Cliente) => run(desbloquearClienteAction, cliente),
    activar: (cliente: Cliente) => run(activarClienteAction, cliente),
    desactivar: async (cliente: Cliente) => {
      const ok = await confirm({
        title: 'Desactivar cliente',
        message: `${cliente.nombre} dejará de aparecer al registrar ventas. Puedes reactivarlo cuando quieras.`,
        confirmLabel: 'Desactivar',
        destructive: true,
      })
      if (ok) run(desactivarClienteAction, cliente)
    },
  }

  const dialogos = (
    <>
      <ClienteForm
        open={formOpen}
        cliente={editando}
        onClose={() => {
          setFormOpen(false)
          setEditando(null)
        }}
        onGuardado={onCambio}
      />
      <BloqueoDialog
        open={!!bloqueando}
        titulo={bloqueando ? `Bloquear a ${bloqueando.nombre}` : 'Bloquear cliente'}
        labelMotivo="Motivo del bloqueo"
        onConfirm={confirmarBloqueo}
        onClose={() => setBloqueando(null)}
      />
    </>
  )

  return { acciones, dialogos, isPending }
}
