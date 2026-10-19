'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'
import { formatFechaHora, formatKg, formatUsd } from '@/lib/format'
import { numeroContrato } from '@/lib/contratos/textos'
import type { CorreccionFactura } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

export interface HistorialCorreccionesFacturaProps {
  correcciones: readonly CorreccionFactura[]
}

function cambios(c: CorreccionFactura): string {
  const partes: string[] = []
  if (c.peso_nuevo_kg !== c.peso_anterior_kg) partes.push(`${formatKg(c.peso_anterior_kg)} → ${formatKg(c.peso_nuevo_kg)}`)
  if (c.precio_nuevo_usd_kg !== c.precio_anterior_usd_kg) {
    partes.push(`USD/kg ${formatUsd(c.precio_anterior_usd_kg)} → ${formatUsd(c.precio_nuevo_usd_kg)}`)
  }
  return partes.join(' · ')
}

/**
 * Historial de correcciones de una factura (17, solo admin): fecha y hora,
 * usuario, línea, valores antes → después, total antes → después, motivo,
 * lotes movidos (kg con signo: + vuelve, − sale) y contrato afectado.
 */
export function HistorialCorreccionesFactura({ correcciones }: HistorialCorreccionesFacturaProps) {
  if (correcciones.length === 0) {
    return <EmptyState compact icon={<HistoryOutlinedIcon fontSize="large" />} title="Sin correcciones" />
  }
  return (
    <List disablePadding aria-label="Historial de correcciones">
      {correcciones.map((c, i) => (
        <ListItem key={c.id} disableGutters divider={i < correcciones.length - 1} sx={{ display: 'block', py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {c.producto_nombre} · {cambios(c)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatFechaHora(c.created_at)} · {c.usuario_nombre ?? 'Usuario'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={NUM}>
            Total {formatUsd(c.total_anterior_usd)} → {formatUsd(c.total_nuevo_usd)}
            {c.estado_nuevo !== c.estado_anterior ? ` · pasa a ${c.estado_nuevo}` : ''}
            {c.pagado_usd > c.total_nuevo_usd ? ` · saldo a favor ${formatUsd(c.pagado_usd - c.total_nuevo_usd)}` : ''}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
            Motivo: {c.motivo}
          </Typography>
          {c.movimientos.length > 0 || c.contrato_id ? (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
              {c.movimientos.map((m, j) => (
                <Chip
                  key={`${m.lote_id ?? 'sin-lote'}-${j}`}
                  size="small"
                  variant="soft"
                  color={m.peso_kg > 0 ? 'success' : 'default'}
                  label={`${m.codigo ?? 'Sin lote'} ${m.peso_kg > 0 ? '+' : '−'}${formatKg(Math.abs(m.peso_kg))}`}
                  sx={NUM}
                />
              ))}
              {c.contrato_id ? (
                <Chip
                  size="small"
                  variant="soft"
                  color="warning"
                  label={`Contrato ${c.contrato_numero != null ? numeroContrato(c.contrato_numero) : ''} afectado`}
                />
              ) : null}
            </Box>
          ) : null}
        </ListItem>
      ))}
    </List>
  )
}
