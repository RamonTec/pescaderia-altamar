'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined'
import type { RowAction } from '@/components/molecules/RowActionsMenu'
import { PerdidaLoteDialog } from '@/components/organisms/PerdidaLoteDialog'
import { formatKg } from '@/lib/format'
import type { Lote } from '@/types/domain'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import { cerrarLoteAction, registrarPerdidaAction } from './actions'

/**
 * Acciones sobre un lote compartidas por `/inventario` y la ficha del lote
 * (07-lotes): registrar pérdida (`PerdidaLoteDialog`), cerrar lote (con
 * `ConfirmDialog` que muestra los kg que se dan de baja) y ver trazabilidad.
 * `dialogos` se renderiza una vez. `estaPendiente(id)` deshabilita el `⋮` del
 * lote con una acción en curso; una segunda acción sobre el mismo lote se
 * ignora. `onCambio` se llama tras cada escritura exitosa.
 */
export function useLoteAcciones({
  onCambio,
  conTrazabilidad = true,
}: { onCambio?: () => void; conTrazabilidad?: boolean } = {}) {
  const router = useRouter()
  const notify = useNotify()
  const confirm = useConfirm()
  const [perdiendo, setPerdiendo] = React.useState<Lote | null>(null)
  const [pendientes, setPendientes] = React.useState<ReadonlySet<string>>(() => new Set())
  const pendientesRef = React.useRef(new Set<string>())

  const marcar = (id: string, activo: boolean) => {
    if (activo) pendientesRef.current.add(id)
    else pendientesRef.current.delete(id)
    setPendientes(new Set(pendientesRef.current))
  }

  const cerrar = async (lote: Lote) => {
    if (pendientesRef.current.has(lote.id)) return
    const ok = await confirm({
      title: `¿Cerrar el lote ${lote.codigo}?`,
      message:
        lote.stock_kg > 0
          ? `Se darán de baja ${formatKg(lote.stock_kg)} como pérdida (cierre) y el lote ya no se podrá vender ni procesar. No se puede deshacer.`
          : 'El lote ya no tiene stock: quedará cerrado. No se puede deshacer.',
      confirmLabel: lote.stock_kg > 0 ? `Dar de baja ${formatKg(lote.stock_kg)}` : 'Cerrar lote',
      destructive: true,
    })
    if (!ok) return
    marcar(lote.id, true)
    try {
      const r = await cerrarLoteAction({
        lote_id: lote.id,
        peso_esperado_kg: lote.stock_kg,
        detalle: '',
      })
      if (r.error) {
        notify.error(r.error)
        return
      }
      notify.success(r.success ?? 'Lote cerrado')
      onCambio?.()
    } catch {
      notify.error('No se pudo cerrar el lote. Revisa tu conexión e intenta de nuevo.')
    } finally {
      marcar(lote.id, false)
    }
  }

  const acciones = (lote: Lote): RowAction[] => {
    const abierto = lote.estado === 'abierto'
    return [
      ...(conTrazabilidad
        ? [
            {
              label: 'Ver trazabilidad',
              icon: <TimelineOutlinedIcon fontSize="small" />,
              onClick: () => router.push(`/inventario/lotes/${lote.id}`),
            },
          ]
        : []),
      {
        label: 'Registrar pérdida',
        icon: <RemoveCircleOutlineOutlinedIcon fontSize="small" />,
        onClick: () => setPerdiendo(lote),
        disabled: !abierto || lote.stock_kg <= 0,
      },
      {
        label: 'Cerrar lote',
        icon: <LockOutlinedIcon fontSize="small" />,
        onClick: () => void cerrar(lote),
        destructive: true,
        disabled: lote.estado === 'cerrado',
      },
    ]
  }

  const dialogos = (
    <PerdidaLoteDialog
      key={perdiendo?.id ?? 'perdida-cerrada'}
      lote={perdiendo}
      onClose={() => setPerdiendo(null)}
      onRegistrar={registrarPerdidaAction}
      onRegistrada={onCambio}
    />
  )

  return {
    acciones,
    dialogos,
    registrarPerdida: setPerdiendo,
    cerrar,
    estaPendiente: (id: string) => pendientes.has(id),
  }
}
