'use client'

import * as React from 'react'
import { BloqueoDialog } from '@/components/organisms/BloqueoDialog'
import { ProveedorForm } from '@/components/organisms/ProveedorForm'
import type { Proveedor, TipoDocumentoProveedor } from '@/types/domain'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'
import {
  activarProveedorAction,
  bloquearProveedorAction,
  desactivarProveedorAction,
  desbloquearProveedorAction,
  type ProveedorActionState,
} from './actions'

type ProveedorAction = (
  prev: ProveedorActionState,
  formData: FormData
) => Promise<ProveedorActionState>

/**
 * Carga de representantes y documentos para editar un proveedor: los datos
 * llegan por props desde quien abre el form (la ficha ya los trajo del
 * servidor con su carga `Promise.all`); nada de `createClient` aquí.
 */
export interface DatosEdicionProveedor {
  representantes: { id: string; nombre: string; cedula: string }[]
  /** Tipos de documento ya presentes (para ✓/⚠ del paso 3). */
  tiposDocumento: Set<TipoDocumentoProveedor>
  /** Representantes que ya tienen su cédula subida. */
  representanteConCedula: Set<string>
}

/**
 * Acciones sobre un proveedor compartidas por el listado y la ficha:
 * alta/edición (ProveedorForm, con Stepper de 3 pasos), bloqueo con motivo
 * (BloqueoDialog), desbloqueo y activar/desactivar con confirmación.
 * `dialogos` debe renderizarse una vez.
 *
 * `estaPendiente(id)` / `pendienteId`: qué proveedor tiene una acción en
 * curso, para deshabilitar su `⋮` (fila o ficha) sin bloquear las demás. Una
 * segunda acción sobre el mismo proveedor mientras la primera corre se ignora
 * (doble envío). Título del bloqueo unificado con clientes: "Bloquear a …".
 *
 * `onCambio` se llama tras cada acción exitosa (la ficha lo usa para
 * `router.refresh()`; el listado ya se revalida con `revalidatePath`).
 */
export function useProveedorAcciones({
  onCambio,
}: { onCambio?: () => void } = {}) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [pendientes, setPendientes] = React.useState<ReadonlySet<string>>(() => new Set())
  // Copia síncrona: dos clics antes del re-render deben ver el primero.
  const pendientesRef = React.useRef(new Set<string>())
  const [formOpen, setFormOpen] = React.useState(false)
  const [pasoInicial, setPasoInicial] = React.useState(0)
  const [editando, setEditando] = React.useState<Proveedor | null>(null)
  const [datosEdicion, setDatosEdicion] = React.useState<DatosEdicionProveedor | null>(null)
  const [bloqueando, setBloqueando] = React.useState<Proveedor | null>(null)
  // El título se conserva mientras el diálogo hace su transición de salida.
  const [tituloBloqueo, setTituloBloqueo] = React.useState('Bloquear proveedor')

  const marcar = (id: string, activo: boolean) => {
    if (activo) pendientesRef.current.add(id)
    else pendientesRef.current.delete(id)
    setPendientes(new Set(pendientesRef.current))
  }

  const run = async (fn: ProveedorAction, proveedor: Proveedor) => {
    if (pendientesRef.current.has(proveedor.id)) return
    marcar(proveedor.id, true)
    try {
      const formData = new FormData()
      formData.set('id', proveedor.id)
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
      marcar(proveedor.id, false)
    }
  }

  const confirmarBloqueo = async (motivo: string) => {
    const proveedor = bloqueando
    if (!proveedor) return { error: null }
    if (pendientesRef.current.has(proveedor.id)) return { error: null }
    marcar(proveedor.id, true)
    try {
      const formData = new FormData()
      formData.set('id', proveedor.id)
      formData.set('motivo', motivo)
      const result = await bloquearProveedorAction({ error: null, success: null }, formData)
      if (result.error) return { error: result.error }
      notify.success(result.success ?? 'Proveedor bloqueado')
      onCambio?.()
      return { error: null }
    } finally {
      marcar(proveedor.id, false)
    }
  }

  const acciones = {
    nuevo: () => {
      setEditando(null)
      setDatosEdicion(null)
      setPasoInicial(0)
      setFormOpen(true)
    },
    /**
     * `pasoInicial`: la ficha abre el paso 3 con "Completar documentos";
     * `datos` son los representantes/documentos que la pantalla ya cargó
     * (si no vienen, el form los pide al abrir edición, con manejo de error).
     */
    editar: (proveedor: Proveedor, paso: number = 0, datos?: DatosEdicionProveedor | null) => {
      setEditando(proveedor)
      setDatosEdicion(datos ?? null)
      setPasoInicial(paso)
      setFormOpen(true)
    },
    bloquear: (proveedor: Proveedor) => {
      setTituloBloqueo(`Bloquear a ${proveedor.nombre}`)
      setBloqueando(proveedor)
    },
    desbloquear: (proveedor: Proveedor) => void run(desbloquearProveedorAction, proveedor),
    activar: (proveedor: Proveedor) => void run(activarProveedorAction, proveedor),
    desactivar: async (proveedor: Proveedor) => {
      if (pendientesRef.current.has(proveedor.id)) return
      const ok = await confirm({
        title: `Desactivar a ${proveedor.nombre}`,
        message: 'Dejará de aparecer al registrar compras. Puedes activarlo de nuevo cuando quieras.',
        confirmLabel: 'Desactivar',
        destructive: true,
      })
      if (ok) await run(desactivarProveedorAction, proveedor)
    },
  }

  const dialogos = (
    <>
      <ProveedorForm
        open={formOpen}
        proveedor={editando}
        pasoInicial={pasoInicial}
        datosEdicion={datosEdicion}
        onClose={() => {
          setFormOpen(false)
          setEditando(null)
          setDatosEdicion(null)
        }}
        onGuardado={onCambio}
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
    /** Último proveedor con una acción en curso (o `null`). */
    pendienteId,
    isPending: pendientes.size > 0,
  }
}