'use client'

import * as React from 'react'
import { useTransition } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { AppDialog } from '@/components/organisms/AppDialog'
import { formatUsd } from '@/lib/format'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import { useNotify } from '@/lib/useNotify'
import { responderCotizacionAction } from '@/app/(protected)/cotizaciones/actions'

export interface CotizacionResumenDialogo {
  id: string
  numero: number
  cliente: string
  total_usd: number
}

export interface ResponderCotizacionDialogProps {
  /** `null` = cerrado. */
  cotizacion: CotizacionResumenDialogo | null
  respuesta: 'aceptada' | 'rechazada'
  onClose: () => void
}

/**
 * Marca una cotización como aceptada (confirmación) o rechazada (motivo
 * opcional ≤ 500), 21-cotizaciones. La respuesta la registra el personal: el
 * cliente no responde desde el enlace en el MVP.
 */
export function ResponderCotizacionDialog({ cotizacion, respuesta, onClose }: ResponderCotizacionDialogProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [motivo, setMotivo] = React.useState('')
  const [errorMotivo, setErrorMotivo] = React.useState<string | null>(null)
  const [errorServidor, setErrorServidor] = React.useState<string | null>(null)
  const submittingRef = React.useRef(false)
  const aceptar = respuesta === 'aceptada'

  const handleClose = () => {
    setMotivo('')
    setErrorMotivo(null)
    setErrorServidor(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!cotizacion || submittingRef.current) return
    submittingRef.current = true
    setErrorServidor(null)
    startTransition(async () => {
      try {
        const r = await responderCotizacionAction({ id: cotizacion.id, respuesta, motivo })
        if (r.error) {
          if (r.fieldErrors?.motivo) setErrorMotivo(r.fieldErrors.motivo)
          else setErrorServidor(r.error)
          return
        }
        notify.success(r.success ?? 'Cotización actualizada')
        handleClose()
      } finally {
        submittingRef.current = false
      }
    })
  }

  return (
    <AppDialog
      open={!!cotizacion}
      onClose={handleClose}
      size="xs"
      title={aceptar ? 'Marcar como aceptada' : 'Marcar como rechazada'}
      subtitle={cotizacion ? `${formatNumeroCotizacion(cotizacion.numero)} · ${cotizacion.cliente}` : undefined}
      onSubmit={handleSubmit}
      pending={isPending}
      dirty={motivo.trim() !== ''}
      error={errorServidor}
      primaryAction={
        <Button type="submit" variant="contained" color={aceptar ? 'primary' : 'error'} loading={isPending}>
          {aceptar ? 'Marcar aceptada' : 'Marcar rechazada'}
        </Button>
      }
    >
      {cotizacion ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              Total {formatUsd(cotizacion.total_usd)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {aceptar
                ? 'Ya no se podrá editar; para cambiarla tendrás que duplicarla.'
                : 'Queda cerrada; el enlace público la mostrará como no vigente.'}
            </Typography>
          </Box>
          {aceptar ? null : (
            <TextField
              label="Motivo (opcional)"
              fullWidth
              size="small"
              multiline
              minRows={3}
              value={motivo}
              disabled={isPending}
              onChange={(e) => {
                setMotivo(e.target.value)
                setErrorMotivo(null)
              }}
              error={!!errorMotivo}
              helperText={errorMotivo ?? 'Hasta 500 caracteres. Solo interno.'}
            />
          )}
        </Box>
      ) : null}
    </AppDialog>
  )
}
