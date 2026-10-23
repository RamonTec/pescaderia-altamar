'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { CotizacionDocumento } from '@/components/organisms/CotizacionDocumento'
import { telefonoAWhatsApp } from '@/lib/cartera/recordatorios/telefono'
import { mensajeConsultaCotizacion, urlWhatsAppCotizacion } from '@/lib/cotizaciones/mensaje'
import { formatFechaHora } from '@/lib/format'
import type { ContactoNegocio, CotizacionPublica } from '@/types/domain'

export interface CotizacionPublicaVistaProps {
  cotizacion: CotizacionPublica
  negocio: ContactoNegocio
  token: string
}

/**
 * Cotización vigente en el enlace público (21-cotizaciones, P7): banner si
 * fue aceptada o ya no está vigente (rechazada), documento de solo lectura
 * (`CotizacionDocumento`, mismo orden que el PDF), «Descargar PDF»,
 * «Escribir por WhatsApp» al negocio y «Actualizada el …».
 */
export function CotizacionPublicaVista({ cotizacion: c, negocio, token }: CotizacionPublicaVistaProps) {
  const movil = telefonoAWhatsApp(negocio.telefono)
  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {c.estado_publico === 'aceptada' ? (
        <Alert severity="success">Esta cotización fue aceptada.</Alert>
      ) : c.estado_publico === 'rechazada' ? (
        <Alert severity="info">Esta cotización ya no está vigente. Escríbenos si quieres una nueva.</Alert>
      ) : null}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
        <Button
          variant="contained"
          startIcon={<DownloadOutlinedIcon />}
          href={`/c/${token}/pdf?descargar=1`}
          sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
        >
          Descargar PDF
        </Button>
        {movil ? (
          <Button
            variant="outlined"
            startIcon={<WhatsAppIcon />}
            href={urlWhatsAppCotizacion(negocio.telefono, mensajeConsultaCotizacion(c.numero))}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          >
            Escribir por WhatsApp
          </Button>
        ) : null}
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 } }}>
        <CotizacionDocumento datos={c} />
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
        Actualizada el {formatFechaHora(c.updated_at)}
      </Typography>
    </Box>
  )
}
