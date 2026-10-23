'use client'

import * as React from 'react'
import { useTransition } from 'react'
import NextLink from 'next/link'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { AppDialog } from '@/components/organisms/AppDialog'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import { useNotify } from '@/lib/useNotify'
import { convertirEnPedidoAction } from '@/app/(protected)/cotizaciones/actions'

export interface CotizacionConvertir {
  id: string
  numero: number
  cliente: string
  /** Cliente libre: hay que registrarlo antes. */
  clienteRegistrado: boolean
  enviada: boolean
}

export interface ConvertirPedidoDialogProps {
  /** `null` = cerrado. */
  cotizacion: CotizacionConvertir | null
  /** Hoy en Venezuela (mínimo de la fecha de entrega). */
  hoy: string
  onClose: () => void
}

/**
 * «Convertir en pedido» (21-cotizaciones, Fase D, P8), `AppDialog xs`: pide
 * la fecha de entrega y crea un pedido agendado de 05 con las mismas líneas
 * (peso estimado = kg) y precios. Con cliente libre, pide registrarlo.
 */
export function ConvertirPedidoDialog({ cotizacion, hoy, onClose }: ConvertirPedidoDialogProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [fecha, setFecha] = React.useState(hoy)
  const [errorFecha, setErrorFecha] = React.useState<string | null>(null)
  const [errorServidor, setErrorServidor] = React.useState<string | null>(null)
  const registrado = cotizacion?.clienteRegistrado ?? true

  const handleClose = () => {
    setFecha(hoy)
    setErrorFecha(null)
    setErrorServidor(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!cotizacion || !registrado || isPending) return
    setErrorServidor(null)
    startTransition(async () => {
      const r = await convertirEnPedidoAction({ id: cotizacion.id, fecha_entrega: fecha })
      if (r.error) {
        if (r.fieldErrors?.fecha_entrega) setErrorFecha(r.fieldErrors.fecha_entrega)
        else setErrorServidor(r.error)
        return
      }
      notify.success(r.success ?? 'Pedido creado')
      handleClose()
    })
  }

  return (
    <AppDialog
      open={!!cotizacion}
      onClose={handleClose}
      size="xs"
      title="Convertir en pedido"
      subtitle={cotizacion ? `${formatNumeroCotizacion(cotizacion.numero)} · ${cotizacion.cliente}` : undefined}
      onSubmit={handleSubmit}
      pending={isPending}
      error={errorServidor}
      primaryAction={
        registrado ? (
          <Button type="submit" variant="contained" loading={isPending}>
            Crear pedido
          </Button>
        ) : null
      }
    >
      {cotizacion ? (
        registrado ? (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Se crea un pedido agendado para {cotizacion.cliente} con las mismas líneas (peso estimado = kg
              cotizados) y los mismos precios por kg.
              {cotizacion.enviada ? ' La cotización queda aceptada.' : ''}
            </Typography>
            <TextField
              label="Fecha de entrega *"
              type="date"
              size="small"
              value={fecha}
              disabled={isPending}
              onChange={(e) => {
                setFecha(e.target.value)
                setErrorFecha(null)
              }}
              error={!!errorFecha}
              helperText={errorFecha ?? 'El IVA y la tasa se deciden al entregar, como en todo pedido.'}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: hoy } }}
            />
          </Box>
        ) : (
          <Alert severity="info">
            Registra el cliente para convertir.{' '}
            <Link component={NextLink} href="/clientes">
              Ir a clientes
            </Link>
            , y luego duplica la cotización eligiéndolo como cliente registrado.
          </Alert>
        )
      ) : null}
    </AppDialog>
  )
}
