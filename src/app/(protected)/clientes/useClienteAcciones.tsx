'use client'

import * as React from 'react'
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
 * `estaPendiente(id)` / `pendienteId`: qué cliente tiene una acción en curso,
 * para deshabilitar su `⋮` (fila o ficha) sin bloquear las demás filas. Una
 * segunda acción sobre el mismo cliente mientras la primera sigue en curso se
 * ignora (doble envío).
 *
 * `onCambio` se llama tras cada acción exitosa (la ficha lo usa para
 * `router.refresh()`; el listado ya se revalida con `revalidatePath`).
 */
export function useClienteAcciones({
  onCambio,
  diasCreditoDefault,
}: { onCambio?: () => void; diasCreditoDefault?: number } = {}) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [pendientes, setPendientes] = React.useState<ReadonlySet<string>>(() => new Set())
  // Copia síncrona: dos clics antes del re-render deben ver el primero.
  const pendientesRef = React.useRef(new Set<string>())
  const [formOpen, setFormOpen] = React.useState(false)
  const [editando, setEditando] = React.useState<Cliente | null>(null)
  const [bloqueando, setBloqueando] = React.useState<Cliente | null>(null)
  // El título se conserva mientras el diálogo hace su transición de salida.
  const [tituloBloqueo, setTituloBloqueo] = React.useState('Bloquear cliente')

  const marcar = (id: string, activo: boolean) => {
    if (activo) pendientesRef.current.add(id)
    else pendientesRef.current.delete(id)
    setPendientes(new Set(pendientesRef.current))
  }

  const run = async (fn: ClienteAction, cliente: Cliente) => {
    if (pendientesRef.current.has(cliente.id)) return
    marcar(cliente.id, true)
    try {
      const formData = new FormData()
      formData.set('id', cliente.id)
      const result = await fn({ error: null, success: null }, formData)
      if (result.error) {
        notify.error(result.error)
        return
      }
      notify.success(result.success ?? 'Cambios guardados')
      onCambio?.()
    } catch {
      notify.error('No se pudo completar la acción. Revisa tu conexión e intenta de nuevo.')
    } finally {
      marcar(cliente.id, false)
    }
  }

  const confirmarBloqueo = async (motivo: string) => {
    const cliente = bloqueando
    if (!cliente) return { error: null }
    if (pendientesRef.current.has(cliente.id)) return { error: null }
    marcar(cliente.id, true)
    try {
      const formData = new FormData()
      formData.set('id', cliente.id)
      formData.set('motivo', motivo)
      const result = await bloquearClienteAction({ error: null, success: null }, formData)
      if (result.error) return { error: result.error }
      notify.success(result.success ?? 'Cliente bloqueado')
      onCambio?.()
      return { error: null }
    } finally {
      marcar(cliente.id, false)
    }
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
    bloquear: (cliente: Cliente) => {
      setTituloBloqueo(`Bloquear a ${cliente.nombre}`)
      setBloqueando(cliente)
    },
    desbloquear: (cliente: Cliente) => void run(desbloquearClienteAction, cliente),
    activar: (cliente: Cliente) => void run(activarClienteAction, cliente),
    desactivar: async (cliente: Cliente) => {
      if (pendientesRef.current.has(cliente.id)) return
      const ok = await confirm({
        title: `Desactivar a ${cliente.nombre}`,
        message: 'Dejará de aparecer al registrar ventas. Puedes activarlo de nuevo cuando quieras.',
        confirmLabel: 'Desactivar',
        destructive: true,
      })
      if (ok) await run(desactivarClienteAction, cliente)
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
        diasCreditoDefault={diasCreditoDefault}
      />
      <BloqueoDialog
        open={!!bloqueando}
        titulo={tituloBloqueo}
        labelMotivo="Motivo del bloqueo"
        onConfirm={confirmarBloqueo}
        onClose={() => setBloqueando(null)}
      />
    </>
  )

  const estaPendiente = React.useCallback((id: string) => pendientes.has(id), [pendientes])
  const pendienteId = pendientes.size > 0 ? [...pendientes][pendientes.size - 1] : null

  return {
    acciones,
    dialogos,
    estaPendiente,
    /** Último cliente con una acción en curso (o `null`). */
    pendienteId,
    isPending: pendientes.size > 0,
  }
}
