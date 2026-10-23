'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CotizacionForm } from '@/components/organisms/CotizacionForm'
import { AnularCotizacionDialog } from '@/components/organisms/AnularCotizacionDialog'
import {
  ResponderCotizacionDialog,
  type CotizacionResumenDialogo,
} from '@/components/organisms/ResponderCotizacionDialog'
import type { ModoCotizacionForm } from '@/lib/cotizaciones/formulario'
import type { CatalogoCotizacion } from '@/lib/services/cotizacionService'
import { useNotify } from '@/lib/useNotify'
import type { CotizacionDetalle } from '@/types/domain'
import { obtenerCotizacionAction } from './actions'

interface EstadoForm {
  modo: ModoCotizacionForm
  cotizacion: CotizacionDetalle | null
  /** Cambia en cada apertura: remonta el formulario con valores nuevos. */
  n: number
}

/**
 * Diálogos y acciones de una cotización (21), compartidos por el listado y
 * la ficha: formulario (crear / editar / duplicar / renovar), responder y
 * anular. Desde el listado, `abrirFormulario` acepta un id y trae el detalle.
 */
export function useCotizacionAcciones(catalogo: CatalogoCotizacion, hoy: string) {
  const router = useRouter()
  const notify = useNotify()
  const [form, setForm] = React.useState<EstadoForm | null>(null)
  const [ultimoForm, setUltimoForm] = React.useState<EstadoForm>({ modo: 'crear', cotizacion: null, n: 0 })
  const [responder, setResponder] = React.useState<{
    cotizacion: CotizacionResumenDialogo
    respuesta: 'aceptada' | 'rechazada'
  } | null>(null)
  const [anular, setAnular] = React.useState<CotizacionResumenDialogo | null>(null)
  const [cargandoId, setCargandoId] = React.useState<string | null>(null)

  const contador = React.useRef(0)

  const abrir = React.useCallback((modo: ModoCotizacionForm, cotizacion: CotizacionDetalle | null) => {
    contador.current += 1
    const siguiente = { modo, cotizacion, n: contador.current }
    setForm(siguiente)
    // Se conserva al cerrar para que el diálogo no cambie de contenido durante la animación.
    setUltimoForm(siguiente)
  }, [])

  const abrirFormulario = React.useCallback(
    async (modo: ModoCotizacionForm, origen: CotizacionDetalle | string | null) => {
      if (origen === null || typeof origen !== 'string') {
        abrir(modo, origen)
        return
      }
      setCargandoId(origen)
      try {
        const r = await obtenerCotizacionAction(origen)
        if (!r.cotizacion) {
          notify.error(r.error ?? 'No se pudo abrir la cotización')
          return
        }
        abrir(modo, r.cotizacion)
      } finally {
        setCargandoId(null)
      }
    },
    [abrir, notify]
  )

  const onGuardada = React.useCallback(
    (id: string) => {
      // Una cotización nueva (crear o duplicar) abre su ficha; editar/renovar refrescan.
      if (form?.modo === 'crear' || form?.modo === 'duplicar') router.push(`/cotizaciones/${id}`)
    },
    [form, router]
  )

  const vista = form ?? ultimoForm

  const dialogos = (
    <>
      <CotizacionForm
        key={vista.n}
        open={form !== null}
        modo={vista.modo}
        cotizacion={vista.cotizacion}
        clientes={catalogo.clientes}
        productos={catalogo.productos}
        ivaPct={catalogo.iva_pct}
        defaults={{ validez_dias: catalogo.validez_dias, terminos: catalogo.terminos }}
        hoy={hoy}
        onClose={() => setForm(null)}
        onGuardada={onGuardada}
      />
      <ResponderCotizacionDialog
        cotizacion={responder?.cotizacion ?? null}
        respuesta={responder?.respuesta ?? 'aceptada'}
        onClose={() => setResponder(null)}
      />
      <AnularCotizacionDialog cotizacion={anular} onClose={() => setAnular(null)} />
    </>
  )

  return {
    abrirFormulario,
    responder: (cotizacion: CotizacionResumenDialogo, respuesta: 'aceptada' | 'rechazada') =>
      setResponder({ cotizacion, respuesta }),
    anular: setAnular,
    cargandoId,
    dialogos,
  }
}
