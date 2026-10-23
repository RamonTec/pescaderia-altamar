'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import { telefonoAWhatsApp } from '@/lib/cartera/recordatorios/telefono'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import {
  mensajeCotizacionGenerica,
  mensajeCotizacionVencida,
  urlWhatsAppCotizacion,
} from '@/lib/cotizaciones/mensaje'
import type { ContactoNegocio } from '@/types/domain'

export type CotizacionNoDisponibleProps =
  | { variante: 'vencida'; numero: number; negocio: ContactoNegocio }
  | { variante: 'generica'; negocio: ContactoNegocio }

/**
 * Página de respaldo del enlace público (21-cotizaciones, P7):
 * - `vencida`: «La cotización COT-000123 venció» + WhatsApp al negocio para
 *   pedir una nueva. Sin fechas, cliente, líneas, importes ni PDF.
 * - `generica`: «Este enlace no está disponible» + WhatsApp genérico. No
 *   revela si el enlace existió, si fue revocado o anulado.
 * Si el teléfono del negocio no es móvil, se muestra como texto.
 */
export function CotizacionNoDisponible(props: CotizacionNoDisponibleProps) {
  const { negocio } = props
  const vencida = props.variante === 'vencida'
  const texto = vencida ? mensajeCotizacionVencida(props.numero) : mensajeCotizacionGenerica()
  const movil = telefonoAWhatsApp(negocio.telefono)
  const nombre = negocio.nombre_comercial || 'nosotros'

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, display: 'grid', gap: 2, justifyItems: 'center', textAlign: 'center' }}>
      <Box sx={{ color: vencida ? 'warning.main' : 'text.secondary' }}>
        {vencida ? <EventBusyOutlinedIcon sx={{ fontSize: 48 }} /> : <LinkOffOutlinedIcon sx={{ fontSize: 48 }} />}
      </Box>
      <Typography variant="h5" component="h1">
        {vencida ? `La cotización ${formatNumeroCotizacion(props.numero)} venció` : 'Este enlace no está disponible'}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '46ch' }}>
        {vencida
          ? 'Escríbenos por WhatsApp y te enviamos una nueva con los precios del día.'
          : `Si necesitas una cotización, escríbele a ${nombre} por WhatsApp.`}
      </Typography>
      {movil ? (
        <Button
          variant="contained"
          size="large"
          startIcon={<WhatsAppIcon />}
          href={urlWhatsAppCotizacion(negocio.telefono, texto)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Escribir por WhatsApp
        </Button>
      ) : negocio.telefono ? (
        <Typography variant="subtitle1">Teléfono: {negocio.telefono}</Typography>
      ) : null}
    </Paper>
  )
}
