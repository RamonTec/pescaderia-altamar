'use client'

import * as React from 'react'
import { useTransition } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { AppDialog } from '@/components/organisms/AppDialog'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import { useNotify } from '@/lib/useNotify'
import { anularCotizacionAction } from '@/app/(protected)/cotizaciones/actions'
import type { CotizacionResumenDialogo } from './ResponderCotizacionDialog'

export interface AnularCotizacionDialogProps {
  /** `null` = cerrado. */
  cotizacion: CotizacionResumenDialogo | null
  onClose: () => void
}

/**
 * Anula una cotización (21-cotizaciones): motivo opcional ≤ 500, aviso de
 * que el enlace público deja de funcionar, primario `color="error"`.
 */
export function AnularCotizacionDialog({ cotizacion, onClose }: AnularCotizacionDialogProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [motivo, setMotivo] = React.useState('')
  const [errorMotivo, setErrorMotivo] = React.useState<string | null>(null)
  const [errorServidor, setErrorServidor] = React.useState<string | null>(null)
  const submittingRef = React.useRef(false)

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
        const r = await anularCotizacionAction({ id: cotizacion.id, motivo })
        if (r.error) {
          if (r.fieldErrors?.motivo) setErrorMotivo(r.fieldErrors.motivo)
          else setErrorServidor(r.error)
          return
        }
        notify.success(r.success ?? 'Cotización anulada')
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
      title="Anular cotización"
      subtitle={cotizacion ? `${formatNumeroCotizacion(cotizacion.numero)} · ${cotizacion.cliente}` : undefined}
      onSubmit={handleSubmit}
      pending={isPending}
      dirty={motivo.trim() !== ''}
      error={errorServidor}
      primaryAction={
        <Button type="submit" variant="contained" color="error" loading={isPending}>
          Anular
        </Button>
      }
    >
      {cotizacion ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Alert severity="warning" variant="outlined">
            El enlace público dejará de funcionar. El número se conserva y la cotización ya no se podrá editar.
          </Alert>
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
            helperText={errorMotivo ?? 'Hasta 500 caracteres.'}
          />
        </Box>
      ) : null}
    </AppDialog>
  )
}
