'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { etiquetaIva } from '@/lib/facturas/iva'
import { formatFecha, formatKg, formatUsd } from '@/lib/format'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import type { CotizacionDocumentoDatos } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

export interface CotizacionDocumentoProps {
  datos: CotizacionDocumentoDatos
  /** Chip(s) junto al número (estado), opcional. */
  estado?: React.ReactNode
  /** Oculta el bloque de número/fechas/cliente (la ficha ya lo muestra en su encabezado). */
  sinEncabezado?: boolean
  /** Oculta notas y términos (la ficha los muestra en su propia sección). */
  sinNotas?: boolean
}

/**
 * Vista de solo lectura de una cotización (21-cotizaciones), mismo orden que
 * el PDF: número y fechas, cliente, líneas, totales en USD (sin Bs, P1),
 * notas para el cliente y términos. La comparten la ficha y la página
 * pública `/c/[token]`: recibe solo datos para el cliente
 * (`CotizacionDocumentoDatos`), nunca notas internas ni ids.
 */
export function CotizacionDocumento({
  datos,
  estado,
  sinEncabezado = false,
  sinNotas = false,
}: CotizacionDocumentoProps) {
  const sinIva = !(datos.iva_pct > 0)
  const notas = sinNotas ? null : datos.notas_cliente
  const terminos = sinNotas ? null : datos.terminos
  return (
    <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
      {sinEncabezado ? null : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            <Typography variant="overline" color="text.secondary">
              Cotización
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h5" component="p" sx={NUM}>
                N.º {formatNumeroCotizacion(datos.numero)}
              </Typography>
              {estado}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Fecha {formatFecha(datos.fecha)} · Válida hasta {formatFecha(datos.fecha_vencimiento)}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gap: 0.25 }}>
            <Typography variant="overline" color="text.secondary">
              Cliente
            </Typography>
            <Typography variant="subtitle1">{datos.cliente.nombre}</Typography>
            {datos.cliente.rif_ci ? (
              <Typography variant="body2" color="text.secondary">
                RIF/CI {datos.cliente.rif_ci}
              </Typography>
            ) : datos.cliente.telefono ? (
              <Typography variant="body2" color="text.secondary">
                Tel. {datos.cliente.telefono}
              </Typography>
            ) : null}
          </Box>
        </Box>
      )}

      {/* Líneas: tabla desde `sm`, lista en `xs`. */}
      <Box sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto' }}>
        <Table size="small" aria-label="Productos cotizados">
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Kg</TableCell>
              <TableCell align="right">Precio USD/kg</TableCell>
              <TableCell align="right">Subtotal USD</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {datos.items.map((i, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Typography variant="body2">{i.producto_nombre}</Typography>
                  {i.nota ? (
                    <Typography variant="caption" color="text.secondary">
                      {i.nota}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell align="right" sx={NUM}>
                  {formatKg(i.peso_kg)}
                </TableCell>
                <TableCell align="right" sx={NUM}>
                  {formatUsd(i.precio_usd_kg)}
                </TableCell>
                <TableCell align="right" sx={NUM}>
                  {formatUsd(i.subtotal_usd)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box component="ul" sx={{ display: { xs: 'grid', sm: 'none' }, gap: 1.5, p: 0, m: 0, listStyle: 'none' }}>
        {datos.items.map((i, idx) => (
          <Box component="li" key={idx} sx={{ display: 'grid', gap: 0.25 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }}>
                {i.producto_nombre}
              </Typography>
              <Typography variant="body2" sx={NUM}>
                {formatUsd(i.subtotal_usd)}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={NUM}>
              {formatKg(i.peso_kg)} × {formatUsd(i.precio_usd_kg)}/kg
            </Typography>
            {i.nota ? (
              <Typography variant="caption" color="text.secondary">
                {i.nota}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>

      <Box
        component="dl"
        aria-label="Totales de la cotización"
        sx={{
          m: 0,
          ml: 'auto',
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          columnGap: 3,
          rowGap: 0.5,
          '& dt': { typography: 'body2', color: 'text.secondary' },
          '& dd': { m: 0, typography: 'body2', textAlign: 'right', ...NUM },
        }}
      >
        <dt>Subtotal</dt>
        <dd>{formatUsd(datos.subtotal_usd)}</dd>
        {datos.descuento_usd > 0 ? (
          <>
            <dt>Descuento</dt>
            <dd>−{formatUsd(datos.descuento_usd)}</dd>
          </>
        ) : null}
        <dt>{etiquetaIva(datos.iva_pct)}</dt>
        <dd>{sinIva ? '—' : formatUsd(datos.iva_usd)}</dd>
        <Box component="dt" sx={{ typography: 'subtitle1', color: 'text.primary', fontWeight: 700 }}>
          Total USD
        </Box>
        <Box component="dd" sx={{ typography: 'subtitle1', fontWeight: 700 }}>
          {formatUsd(datos.total_usd)}
        </Box>
      </Box>

      {notas || terminos ? <Divider /> : null}
      {notas ? (
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Typography variant="subtitle2">Notas</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
            {notas}
          </Typography>
        </Box>
      ) : null}
      {terminos ? (
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Typography variant="subtitle2">Términos y condiciones</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {terminos}
          </Typography>
        </Box>
      ) : null}
    </Box>
  )
}
