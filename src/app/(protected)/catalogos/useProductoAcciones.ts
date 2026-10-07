'use client'

import * as React from 'react'
import type { Producto } from '@/types/domain'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'
import {
  activarProductoAction,
  desactivarProductoAction,
  type ProductoActionState,
} from './actions'

type ProductoAccion = (
  prev: ProductoActionState,
  formData: FormData
) => Promise<ProductoActionState>

/**
 * Acciones de fila sobre un producto (desactivar con confirmación, activar),
 * patrón de `useClienteAcciones` (10). `pendienteId` marca el producto cuya
 * acción está en curso para deshabilitar su `⋮` sin bloquear las demás filas;
 * una segunda acción sobre el mismo producto mientras la primera corre se
 * ignora (doble envío).
 */
export function useProductoAcciones({ onCambio }: { onCambio?: () => void } = {}) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [pendientes, setPendientes] = React.useState<ReadonlySet<string>>(() => new Set())
  // Copia síncrona: dos clics antes del re-render deben ver el primero.
  const pendientesRef = React.useRef(new Set<string>())

  const marcar = (id: string, activo: boolean) => {
    if (activo) pendientesRef.current.add(id)
    else pendientesRef.current.delete(id)
    setPendientes(new Set(pendientesRef.current))
  }

  const run = async (fn: ProductoAccion, producto: Producto) => {
    if (pendientesRef.current.has(producto.id)) return
    marcar(producto.id, true)
    try {
      const formData = new FormData()
      formData.set('id', producto.id)
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
      marcar(producto.id, false)
    }
  }

  const acciones = {
    activar: (producto: Producto) => void run(activarProductoAction, producto),
    desactivar: async (producto: Producto) => {
      if (pendientesRef.current.has(producto.id)) return
      const ok = await confirm({
        title: `Desactivar «${producto.nombre}»`,
        message: 'No se podrá usar en nuevas compras. Puedes activarlo de nuevo cuando quieras.',
        confirmLabel: 'Desactivar',
        destructive: true,
      })
      if (ok) await run(desactivarProductoAction, producto)
    },
  }

  const estaPendiente = React.useCallback((id: string) => pendientes.has(id), [pendientes])
  const pendienteId = pendientes.size > 0 ? [...pendientes][pendientes.size - 1] : null

  return {
    acciones,
    estaPendiente,
    /** Último producto con una acción en curso (o `null`). */
    pendienteId,
    isPending: pendientes.size > 0,
  }
}