'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import type { RowAction } from '@/components/molecules/RowActionsMenu'
import {
  GenerarContratoDialog,
  type OrigenContratoUI,
  type ResultadoGenerar,
} from '@/components/organisms/GenerarContratoDialog'
import type { GenerarContratoFormValues } from '@/lib/contratoValidation'
import { transicionValida } from '@/lib/contratoValidation'
import { numeroContrato } from '@/lib/contratos/textos'
import { useGlobalLoader } from '@/lib/useGlobalLoader'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import type { ElegibilidadContrato, EstadoContrato } from '@/types/domain'
import { cambiarEstadoContratoAction, generarContratoAction } from './actions'

export type { OrigenContratoUI }

/** Contrato sobre el que actúa el menú de la bitácora. */
export interface ContratoAccionable {
  id: string
  numero: number
  estado: EstadoContrato
  tipo: OrigenContratoUI['tipo']
}

const urlPdf = (id: string, descargar = false) => `/contratos/${id}/pdf${descargar ? '?descargar=1' : ''}`

/**
 * Acciones de contrato (06-contratos), únicas para las 4 tablas de origen y
 * la bitácora. El `window.open` va sincrónico en el clic (sin `await` previo)
 * para que el navegador no lo bloquee como ventana emergente.
 */
export function useContratoAcciones() {
  const router = useRouter()
  const loader = useGlobalLoader()
  const confirm = useConfirm()
  const notify = useNotify()
  const [origen, setOrigen] = React.useState<OrigenContratoUI | null>(null)
  const [pendientes, setPendientes] = React.useState<ReadonlySet<string>>(new Set())

  const marcar = React.useCallback((id: string, activo: boolean) => {
    setPendientes((prev) => {
      const next = new Set(prev)
      if (activo) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const verPdf = React.useCallback((id: string) => {
    window.open(urlPdf(id), '_blank', 'noopener')
  }, [])

  const descargar = React.useCallback((id: string) => {
    window.open(urlPdf(id, true), '_blank', 'noopener')
  }, [])

  const generar = React.useCallback(
    async (o: OrigenContratoUI, values: GenerarContratoFormValues): Promise<ResultadoGenerar> => {
      const input =
        o.tipo === 'venta_credito'
          ? { tipo: o.tipo, factura_id: o.id, dias_credito: values.dias_credito, notas: values.notas }
          : { tipo: o.tipo, compra_id: o.id, dias_credito: values.dias_credito, notas: values.notas }
      const resultado = await loader.run(() => generarContratoAction(input), 'Generando contrato')
      if (resultado.error) return { error: resultado.error, fieldErrors: resultado.fieldErrors }
      notify.success(resultado.success ?? 'Contrato generado')
      setOrigen(null)
      router.refresh()
      return { error: null }
    },
    [loader, notify, router]
  )

  const cambiarEstado = React.useCallback(
    async (contrato: ContratoAccionable, estado: Exclude<EstadoContrato, 'generado'>) => {
      if (estado === 'anulado') {
        const documento = contrato.tipo === 'venta_credito' ? 'esta factura' : 'esta compra'
        const ok = await confirm({
          title: `Anular el contrato ${numeroContrato(contrato.numero)}`,
          message: `El PDF se conserva y podrás generar otro para ${documento}.`,
          confirmLabel: 'Anular',
          destructive: true,
        })
        if (!ok) return
      }
      marcar(contrato.id, true)
      try {
        const resultado = await cambiarEstadoContratoAction({ id: contrato.id, estado })
        if (resultado.error) {
          notify.error(resultado.error)
          return
        }
        notify.success(resultado.success ?? 'Contrato actualizado')
        router.refresh()
      } finally {
        marcar(contrato.id, false)
      }
    },
    [confirm, marcar, notify, router]
  )

  /** Opciones del `⋮` de una factura o compra (tabla de spec › UI). Contado: sin entrada → []. */
  const accionesDeOrigen = React.useCallback(
    (o: OrigenContratoUI, elegibilidad: ElegibilidadContrato | undefined): RowAction[] => {
      if (!elegibilidad) return []
      const lista: RowAction[] = []
      const activo = elegibilidad.contratoActivo
      if (activo) {
        lista.push({
          label: `Ver contrato ${numeroContrato(activo.numero)}`,
          icon: <PictureAsPdfOutlinedIcon fontSize="small" />,
          onClick: () => verPdf(activo.id),
        })
      } else {
        lista.push({
          label: elegibilidad.motivo ? `Generar contrato (${elegibilidad.motivo})` : 'Generar contrato',
          icon: <DescriptionOutlinedIcon fontSize="small" />,
          disabled: !elegibilidad.puedeGenerar,
          onClick: () => setOrigen(o),
        })
      }
      return lista
    },
    [verPdf]
  )

  /** Opciones del `⋮` de la bitácora: ver, descargar y solo las transiciones válidas. */
  const accionesDeContrato = React.useCallback(
    (contrato: ContratoAccionable): RowAction[] => {
      const lista: RowAction[] = [
        {
          label: 'Ver PDF',
          icon: <PictureAsPdfOutlinedIcon fontSize="small" />,
          onClick: () => verPdf(contrato.id),
        },
        {
          label: 'Descargar',
          icon: <FileDownloadOutlinedIcon fontSize="small" />,
          onClick: () => descargar(contrato.id),
        },
      ]
      if (transicionValida(contrato.estado, 'enviado')) {
        lista.push({
          label: 'Marcar como enviado',
          icon: <SendOutlinedIcon fontSize="small" />,
          onClick: () => void cambiarEstado(contrato, 'enviado'),
        })
      }
      if (transicionValida(contrato.estado, 'firmado')) {
        lista.push({
          label: 'Marcar como firmado',
          icon: <DrawOutlinedIcon fontSize="small" />,
          onClick: () => void cambiarEstado(contrato, 'firmado'),
        })
      }
      if (transicionValida(contrato.estado, 'anulado')) {
        lista.push({
          label: 'Anular',
          icon: <BlockOutlinedIcon fontSize="small" />,
          destructive: true,
          onClick: () => void cambiarEstado(contrato, 'anulado'),
        })
      }
      return lista
    },
    [verPdf, descargar, cambiarEstado]
  )

  const estaPendiente = React.useCallback((id: string) => pendientes.has(id), [pendientes])

  const dialogos = (
    <GenerarContratoDialog origen={origen} onClose={() => setOrigen(null)} onGenerar={generar} />
  )

  return { accionesDeOrigen, accionesDeContrato, verPdf, descargar, cambiarEstado, estaPendiente, dialogos }
}
