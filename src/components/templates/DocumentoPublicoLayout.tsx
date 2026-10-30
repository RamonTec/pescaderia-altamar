'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { BrandMark } from '@/components/atoms/BrandMark'
import { FileteLaton } from '@/components/atoms/FileteLaton'

export interface DocumentoPublicoLayoutProps {
  /** Línea de datos del negocio bajo la marca (razón social, RIF, teléfono…). */
  datosNegocio?: string | null
  children: React.ReactNode
}

/**
 * Plantilla de las páginas públicas sin sesión (21-cotizaciones, `/c/[token]`):
 * marca y filete de latón bajo el encabezado, sin `AppShell`, menú ni
 * datos de usuario. Contenido centrado (máx. 880 px), responsive desde
 * 375 px y claro/oscuro según el sistema. Reutilizable para otros
 * documentos públicos.
 */
export function DocumentoPublicoLayout({ datosNegocio, children }: DocumentoPublicoLayoutProps) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box component="header" sx={{ bgcolor: 'background.paper' }}>
        <Container maxWidth={false} sx={{ maxWidth: 880, py: { xs: 2, sm: 2.5 }, px: { xs: 2, sm: 3 } }}>
          <BrandMark size={44} />
          {datosNegocio ? (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
              {datosNegocio}
            </Typography>
          ) : null}
        </Container>
        <FileteLaton />
      </Box>
      <Container
        component="main"
        maxWidth={false}
        sx={{ maxWidth: 880, flex: 1, py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 3 } }}
      >
        {children}
      </Container>
      <Box component="footer" sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Documento no fiscal. Precios sujetos a disponibilidad de producto.
        </Typography>
      </Box>
    </Box>
  )
}
