'use client'

import * as React from 'react'
import { EmpleadoForm } from '@/components/organisms/EmpleadoForm'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import { cambiarActivoEmpleadoAction } from './[id]/actions'
import type { Empleado } from '@/types/domain'

/**
 * Acciones de empleado compartidas por la pestaña Empleados de `/gastos` y
 * la ficha (20-gastos, Fase B): alta / edición en `EmpleadoForm` y
 * desactivar (con confirmación) / activar.
 */
export function useEmpleadoAcciones() {
  const confirm = useConfirm()
  const notify = useNotify()
  const [form, setForm] = React.useState<{ empleado: Empleado | null } | null>(null)
  const [pendienteId, setPendienteId] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()

  const cambiarActivo = React.useCallback(
    async (e: Empleado) => {
      if (e.activo) {
        const ok = await confirm({
          title: `¿Desactivar a ${e.nombre}?`,
          message: 'No recibirá pagos de nómina nuevos. Sus pagos hechos siguen en los reportes y en su costo.',
          confirmLabel: 'Desactivar',
          destructive: true,
        })
        if (!ok) return
      }
      setPendienteId(e.id)
      startTransition(async () => {
        const r = await cambiarActivoEmpleadoAction({ id: e.id, activo: !e.activo })
        setPendienteId(null)
        if (r.error) notify.error(r.error)
        else notify.success(r.success ?? 'Empleado actualizado')
      })
    },
    [confirm, notify]
  )

  const nuevo = React.useCallback(() => setForm({ empleado: null }), [])
  const editar = React.useCallback((e: Empleado) => setForm({ empleado: e }), [])

  const dialogo = (
    <EmpleadoForm
      key={form ? (form.empleado?.id ?? 'nuevo') : 'cerrado'}
      open={!!form}
      empleado={form?.empleado ?? null}
      onClose={() => setForm(null)}
    />
  )

  return { nuevo, editar, cambiarActivo, pendienteId, dialogo }
}
