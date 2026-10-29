'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { EstadoChip } from '@/components/atoms/EstadoChip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'
import { formatFechaHora, formatKg, formatUsd } from '@/lib/format'
import { numeroContrato } from '@/lib/contratos/textos'
import { etiquetaIva } from '@/lib/facturas/iva'
import type { CorreccionFactura, CorreccionLinea } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

export interface HistorialCorreccionesFacturaProps {
  correcciones: readonly CorreccionFactura[]
}

function cambios(c: CorreccionLinea): string {
  const partes: string[] = []
  if (c.peso_nuevo_kg !== c.peso_anterior_kg) partes.push(`${formatKg(c.peso_anterior_kg)} → ${formatKg(c.peso_nuevo_kg)}`)
  if (c.precio_nuevo_usd_kg !== c.precio_anterior_usd_kg) {
    partes.push(`USD/kg ${formatUsd(c.precio_anterior_usd_kg)} → ${formatUsd(c.precio_nuevo_usd_kg)}`)
  }
  return partes.join(' · ')
}

/** Título de la fila: línea con sus cambios (17) o cambio de IVA (18). */
function titulo(c: CorreccionFactura): string {
  if (c.tipo === 'iva') return `${etiquetaIva(c.iva_pct_anterior)} → ${etiquetaIva(c.iva_pct_nuevo)}`
  return `${c.producto_nombre} · ${cambios(c)}`
}

/** Saldo a favor que dejó la corrección (lo pagado + créditos supera el total). */
function saldoAFavor(c: CorreccionFactura): number {
  const creditos = c.tipo === 'iva' ? c.creditos_nuevo_usd : 0
  return Math.round((c.pagado_usd + creditos - c.total_nuevo_usd) * 1e6) / 1e6
}

/**
 * Historial de correcciones de una factura (17, solo admin): fecha y hora,
 * usuario, línea, valores antes → después, total antes → después, motivo,
 * lotes movidos (kg con signo: + vuelve, − sale) y contrato afectado.
 * 18-iva-opcional: las filas de IVA se leen «IVA 16 % → Sin IVA», con los
 * créditos de notas antes → después si cambiaron; sin línea ni lotes.
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
              {titulo(c)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatFechaHora(c.created_at)} · {c.usuario_nombre ?? 'Usuario'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={NUM}>
            Total {formatUsd(c.total_anterior_usd)} → {formatUsd(c.total_nuevo_usd)}
            {c.estado_nuevo !== c.estado_anterior ? ` · pasa a ${c.estado_nuevo}` : ''}
            {c.tipo === 'iva' && c.creditos_nuevo_usd !== c.creditos_anterior_usd
              ? ` · notas de crédito ${formatUsd(c.creditos_anterior_usd)} → ${formatUsd(c.creditos_nuevo_usd)}`
              : ''}
            {saldoAFavor(c) > 0 ? ` · saldo a favor ${formatUsd(saldoAFavor(c))}` : ''}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
            Motivo: {c.motivo}
          </Typography>
          {(c.tipo === 'linea' && c.movimientos.length > 0) || c.contrato_id ? (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
              {(c.tipo === 'linea' ? c.movimientos : []).map((m, j) => (
                <EstadoChip
                  key={`${m.lote_id ?? 'sin-lote'}-${j}`}
                  tono={m.peso_kg > 0 ? 'success' : 'neutral'}
                  label={`${m.codigo ?? 'Sin lote'} ${m.peso_kg > 0 ? '+' : '−'}${formatKg(Math.abs(m.peso_kg))}`}
                  sx={NUM}
                />
              ))}
              {c.contrato_id ? (
                <EstadoChip
                  tono="warning"
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
