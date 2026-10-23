'use client'

import * as React from 'react'
import { useTransition } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import { CopyableText } from '@/components/molecules/CopyableText'
import { urlPublica } from '@/lib/cotizaciones/enlace'
import { formatFechaHora } from '@/lib/format'
import { useConfirm } from '@/lib/useConfirm'
import { useNotify } from '@/lib/useNotify'
import { enlaceCotizacionAction } from '@/app/(protected)/cotizaciones/[id]/actions'

export interface EnlacePublicoCotizacionProps {
  id: string
  token: string | null
  /** Base absoluta (`SITE_URL` o el origin de la petición), resuelta en el servidor. */
  base: string
  generadoAt: string | null
  generadoPor: string | null
  /** Anulada: sin enlace ni acciones. */
  anulada: boolean
  vencida: boolean
}

/**
 * Sección «Enlace público» de la ficha (21-cotizaciones, P7): URL copiable,
 * quién y cuándo lo generó, Crear / Regenerar / Revocar (con confirmación)
 * y «Ver como el cliente» en pestaña nueva.
 */
export function EnlacePublicoCotizacion({
  id,
  token,
  base,
  generadoAt,
  generadoPor,
  anulada,
  vencida,
}: EnlacePublicoCotizacionProps) {
  const confirm = useConfirm()
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()

  const ejecutar = (operacion: 'crear' | 'regenerar' | 'revocar') =>
    startTransition(async () => {
      const r = await enlaceCotizacionAction(id, operacion)
      if (r.error) notify.error(r.error)
      else notify.success(r.success ?? 'Listo')
    })

  const regenerar = async () => {
    const ok = await confirm({
      title: '¿Regenerar el enlace?',
      message: 'El enlace anterior dejará de funcionar. Tendrás que compartir el nuevo.',
      confirmLabel: 'Regenerar',
      destructive: true,
    })
    if (ok) ejecutar('regenerar')
  }

  const revocar = async () => {
    const ok = await confirm({
      title: '¿Revocar el enlace?',
      message: 'El enlace anterior dejará de funcionar. El cliente verá una página «no disponible».',
      confirmLabel: 'Revocar',
      destructive: true,
    })
    if (ok) ejecutar('revocar')
  }

  if (anulada) {
    return (
      <Typography variant="body2" color="text.secondary">
        Una cotización anulada no tiene enlace público.
      </Typography>
    )
  }

  if (!token) {
    return (
      <Box sx={{ display: 'grid', gap: 1.5, justifyItems: 'start' }}>
        <Typography variant="body2" color="text.secondary">
          Sin enlace. Al compartir se crea uno; el cliente verá la cotización mientras esté vigente.
        </Typography>
        <Button variant="outlined" onClick={() => ejecutar('crear')} loading={isPending}>
          Crear enlace
        </Button>
      </Box>
    )
  }

  const url = urlPublica(token, base)
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <CopyableText value={url} mono={false} copiedMessage="Enlace copiado" />
      </Box>
      <Typography variant="caption" color="text.secondary">
        Generado {formatFechaHora(generadoAt)}
        {generadoPor ? ` por ${generadoPor}` : ''}
        {vencida ? ' · Vencida: el enlace muestra «venció» hasta que la renueves.' : ''}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<OpenInNewOutlinedIcon />}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver como el cliente
        </Button>
        <Button variant="outlined" size="small" onClick={regenerar} disabled={isPending}>
          Regenerar
        </Button>
        <Button variant="outlined" size="small" color="error" onClick={revocar} disabled={isPending}>
          Revocar
        </Button>
      </Box>
    </Box>
  )
}
