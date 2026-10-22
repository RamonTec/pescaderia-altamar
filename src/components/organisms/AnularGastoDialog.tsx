'use client'

import * as React from 'react'
import { useTransition } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { AppDialog } from '@/components/organisms/AppDialog'
import { anularGastoSchema, descartarGastoSchema } from '@/lib/gastoValidation'
import { formatBs, formatFecha, formatUsd } from '@/lib/format'
import { useNotify } from '@/lib/useNotify'
import { anularGastoAction, descartarGastoAction } from '@/app/(protected)/gastos/actions'
import type { Gasto } from '@/types/domain'

export interface AnularGastoDialogProps {
  /** Gasto a anular (confirmado) o descartar (pendiente); `null` = cerrado. */
  gasto: Pick<Gasto, 'id' | 'fecha' | 'descripcion' | 'moneda' | 'monto' | 'monto_usd'> | null
  /** `anular`: motivo obligatorio 5–500. `descartar`: motivo opcional ≤ 500. */
  modo?: 'anular' | 'descartar'
  onClose: () => void
}

/**
 * Anulación de un gasto confirmado con motivo (20-gastos), mismo patrón que
 * `BloqueoDialog`: `AppDialog xs`, primario `color="error"`, mientras guarda
 * no se cierra, con el motivo escrito cerrar pide "¿Descartar cambios?" y un
 * segundo envío se ignora. Con `modo="descartar"` (pendientes, Fase C) el
 * motivo es opcional. El error sobre el motivo va en el campo; el resto, en
 * el `Alert`.
 */
export function AnularGastoDialog({ gasto, modo = 'anular', onClose }: AnularGastoDialogProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [motivo, setMotivo] = React.useState('')
  const [errorMotivo, setErrorMotivo] = React.useState<string | null>(null)
  const [errorServidor, setErrorServidor] = React.useState<string | null>(null)
  const submittingRef = React.useRef(false)
  const anular = modo === 'anular'

  const handleClose = () => {
    setMotivo('')
    setErrorMotivo(null)
    setErrorServidor(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!gasto || submittingRef.current) return
    const schema = anular ? anularGastoSchema : descartarGastoSchema
    const safe = schema.safeParse({ id: gasto.id, motivo })
    if (!safe.success) {
      setErrorMotivo(safe.error.issues[0]?.message ?? 'Motivo inválido')
      return
    }
    submittingRef.current = true
    setErrorMotivo(null)
    setErrorServidor(null)
    startTransition(async () => {
      try {
        const result = anular ? await anularGastoAction(safe.data) : await descartarGastoAction(safe.data)
        if (result.error) {
          if (result.fieldErrors?.motivo) setErrorMotivo(result.fieldErrors.motivo)
          else setErrorServidor(result.error)
          return
        }
        notify.success(result.success ?? (anular ? 'Gasto anulado' : 'Gasto descartado'))
        handleClose()
      } finally {
        submittingRef.current = false
      }
    })
  }

  return (
    <AppDialog
      open={!!gasto}
      onClose={handleClose}
      size="xs"
      title={anular ? 'Anular gasto' : 'Descartar gasto pendiente'}
      subtitle={gasto ? `${formatFecha(gasto.fecha)} · ${gasto.descripcion}` : undefined}
      onSubmit={handleSubmit}
      pending={isPending}
      dirty={motivo.trim() !== ''}
      error={errorServidor}
      primaryAction={
        <Button
          type="submit"
          variant="contained"
          color="error"
          loading={isPending}
          disabled={anular && !motivo.trim()}
        >
          {anular ? 'Anular' : 'Descartar'}
        </Button>
      }
    >
      {gasto ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {gasto.moneda === 'bs' ? formatBs(gasto.monto) : formatUsd(gasto.monto)}
              {gasto.moneda === 'bs' && gasto.monto_usd !== null ? ` · ${formatUsd(gasto.monto_usd)}` : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {anular
                ? 'Deja de contar en los totales. Queda visible como anulado, con quién y cuándo.'
                : 'El período no se vuelve a generar.'}
            </Typography>
          </Box>
          <TextField
            label={anular ? 'Motivo *' : 'Motivo (opcional)'}
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
            helperText={errorMotivo ?? (anular ? 'Mínimo 5 caracteres.' : 'Hasta 500 caracteres.')}
          />
        </Box>
      ) : null}
    </AppDialog>
  )
}
