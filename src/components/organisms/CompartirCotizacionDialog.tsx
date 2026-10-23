'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import { AppDialog } from '@/components/organisms/AppDialog'
import { CopyableText } from '@/components/molecules/CopyableText'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import { urlWhatsAppCotizacion } from '@/lib/cotizaciones/mensaje'
import { telefonoAWhatsApp } from '@/lib/cartera/recordatorios/telefono'
import type { EstadoEfectivoCotizacion } from '@/types/domain'
import type { EnvioCotizacion } from '@/lib/services/cotizacionService'
import { useNotify } from '@/lib/useNotify'
import { marcarEnviadaAction, prepararEnvioAction } from '@/app/(protected)/cotizaciones/actions'

export interface CotizacionCompartir {
  id: string
  numero: number
  cliente: string
  estado_efectivo: EstadoEfectivoCotizacion
}

export interface CompartirCotizacionDialogProps {
  /** `null` = cerrado. El padre cambia la `key` en cada apertura. */
  cotizacion: CotizacionCompartir | null
  onClose: () => void
  /** Vencida: abre el formulario en modo renovar. */
  onRenovar: () => void
}

/**
 * Compartir una cotización (21-cotizaciones, P10), `AppDialog sm`.
 *
 * - Vencida: no comparte; pide renovarla (el enlace no la mostraría, P7).
 * - Al abrir: `prepararEnvio` (crea el enlace si falta; URL, mensaje y
 *   teléfono) y precarga el PDF como `File`.
 * - «Compartir PDF» solo si `navigator.canShare({ files })`; llama a
 *   `navigator.share` en el mismo clic (sin `await` previo). «Enviar por
 *   WhatsApp» abre `wa.me` en el mismo clic. «Copiar enlace» y «Descargar
 *   PDF» siempre. El mensaje se puede editar antes de enviar.
 * - Tras compartir, copiar o abrir WhatsApp: `marcarEnviada` en segundo
 *   plano (un borrador pasa a enviada). Cancelar la hoja (`AbortError`) no marca.
 */
export function CompartirCotizacionDialog({ cotizacion, onClose, onRenovar }: CompartirCotizacionDialogProps) {
  const notify = useNotify()
  const [envio, setEnvio] = React.useState<EnvioCotizacion | null>(null)
  const [mensaje, setMensaje] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [archivo, setArchivo] = React.useState<File | null>(null)
  const [puedeCompartirArchivo, setPuedeCompartirArchivo] = React.useState(false)
  const marcadaRef = React.useRef(false)
  const vencida = cotizacion?.estado_efectivo === 'vencida'
  const id = cotizacion?.id ?? null
  const numero = cotizacion?.numero ?? 0

  React.useEffect(() => {
    if (!id || vencida) return
    let vigente = true
    void (async () => {
      const r = await prepararEnvioAction(id)
      if (!vigente) return
      if (!r.envio) {
        setError(r.error ?? 'No se pudo preparar el envío')
        return
      }
      setEnvio(r.envio)
      setMensaje(r.envio.mensaje)
      try {
        const resp = await fetch(`/cotizaciones/${id}/pdf`, { cache: 'no-store' })
        if (!resp.ok || !vigente) return
        const blob = await resp.blob()
        const file = new File([blob], `cotizacion-${formatNumeroCotizacion(numero)}.pdf`, {
          type: 'application/pdf',
        })
        if (!vigente) return
        setArchivo(file)
        setPuedeCompartirArchivo(
          typeof navigator !== 'undefined' &&
            typeof navigator.canShare === 'function' &&
            navigator.canShare({ files: [file] })
        )
      } catch {
        // Sin PDF precargado: quedan WhatsApp, copiar y descargar.
      }
    })()
    return () => {
      vigente = false
    }
  }, [id, numero, vencida])

  /** En segundo plano: el gesto del usuario ya abrió WhatsApp o la hoja. */
  const marcar = React.useCallback(() => {
    if (!id || marcadaRef.current) return
    marcadaRef.current = true
    void marcarEnviadaAction(id).then((r) => {
      if (r.error) notify.error(r.error)
      else if (r.success) notify.success(r.success)
    })
  }, [id, notify])

  const compartirArchivo = () => {
    if (!archivo || !envio) return
    // Sin `await` antes de `share`: debe correr dentro del gesto del clic.
    navigator
      .share({ files: [archivo], text: mensaje })
      .then(marcar)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        notify.error('No se pudo abrir la hoja de compartir')
      })
  }

  const enviarWhatsApp = () => {
    if (!envio) return
    window.open(urlWhatsAppCotizacion(envio.telefono, mensaje), '_blank', 'noopener')
    marcar()
  }

  const sinMovil = envio ? telefonoAWhatsApp(envio.telefono) === null : false

  return (
    <AppDialog
      open={cotizacion !== null}
      onClose={onClose}
      size="sm"
      title="Compartir cotización"
      subtitle={cotizacion ? `${formatNumeroCotizacion(cotizacion.numero)} · ${cotizacion.cliente}` : undefined}
      cancelLabel="Cerrar"
      error={error}
      primaryAction={
        vencida ? (
          <Button variant="contained" onClick={onRenovar}>
            Renovar
          </Button>
        ) : (
          <Button variant="contained" startIcon={<WhatsAppIcon />} onClick={enviarWhatsApp} disabled={!envio}>
            Enviar por WhatsApp
          </Button>
        )
      }
    >
      {vencida ? (
        <Alert severity="warning">
          Renueva la cotización antes de compartirla: vencida, el enlace ya no la muestra.
        </Alert>
      ) : !envio && !error ? (
        <Box sx={{ display: 'grid', gap: 1.5 }} aria-busy>
          <Skeleton variant="rounded" height={40} />
          <Skeleton variant="rounded" height={96} />
        </Box>
      ) : envio ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              Enlace público
            </Typography>
            <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <CopyableText value={envio.url} mono={false} copiedMessage="Enlace copiado" onCopied={marcar} />
            </Box>
          </Box>
          <TextField
            label="Mensaje"
            multiline
            minRows={4}
            fullWidth
            size="small"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            helperText={
              sinMovil
                ? 'El cliente no tiene un móvil válido: WhatsApp te pedirá elegir el contacto.'
                : 'Puedes editarlo antes de enviarlo.'
            }
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {puedeCompartirArchivo ? (
              <Button variant="outlined" startIcon={<IosShareOutlinedIcon />} onClick={compartirArchivo}>
                Compartir PDF
              </Button>
            ) : null}
            <Button
              variant="outlined"
              startIcon={<DownloadOutlinedIcon />}
              href={`/cotizaciones/${id ?? ''}/pdf?descargar=1`}
              target="_blank"
              rel="noopener"
            >
              Descargar PDF
            </Button>
          </Box>
        </Box>
      ) : null}
    </AppDialog>
  )
}
