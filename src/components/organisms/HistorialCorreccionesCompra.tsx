'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'
import { fechaCorta, numeroContrato } from '@/lib/contratos/textos'
import { formatMoneda } from '@/lib/compras/textos'
import { ETIQUETA_CONDICION, ETIQUETA_MONEDA } from '@/lib/dashboard/etiquetas'
import { formatFechaHora, formatKg, formatTasa, formatUsd } from '@/lib/format'
import type { CorreccionCompra } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

/** «Proveedor: A → B · Tasa 36,50 → 37,10 (manual)». */
function cambiosCabecera(c: CorreccionCompra): string[] {
  const partes: string[] = []
  if (c.proveedor_nuevo.id !== c.proveedor_anterior.id) {
    partes.push(`Proveedor: ${c.proveedor_anterior.nombre} → ${c.proveedor_nuevo.nombre}`)
  }
  if (c.fecha_nueva !== c.fecha_anterior) partes.push(`Fecha: ${fechaCorta(c.fecha_anterior)} → ${fechaCorta(c.fecha_nueva)}`)
  if (c.condicion_nueva !== c.condicion_anterior) {
    partes.push(`Condición: ${ETIQUETA_CONDICION[c.condicion_anterior]} → ${ETIQUETA_CONDICION[c.condicion_nueva]}`)
  }
  if (c.moneda_nueva !== c.moneda_anterior) {
    partes.push(`Moneda: ${ETIQUETA_MONEDA[c.moneda_anterior]} → ${ETIQUETA_MONEDA[c.moneda_nueva]}`)
  }
  if (
    c.tasa_nueva !== c.tasa_anterior ||
    c.tasa_origen_nueva !== c.tasa_origen_anterior ||
    c.tasa_fuente_nueva !== c.tasa_fuente_anterior
  ) {
    partes.push(
      `Tasa ${formatTasa(c.tasa_anterior)} → ${formatTasa(c.tasa_nueva)} (${c.tasa_origen_nueva === 'manual' ? 'manual' : 'referencial'})`
    )
  }
  if ((c.notas_nueva ?? '') !== (c.notas_anterior ?? '')) partes.push('Notas')
  return partes
}

/** «SALM-261005-1: kg 30,000 → 28,500 · Bs. 3.500,00/kg → Bs. 3.400,00». */
function cambiosLineas(c: CorreccionCompra): string[] {
  return c.items.map((i) => {
    const partes: string[] = []
    if (i.peso_nuevo_kg !== i.peso_anterior_kg) partes.push(`kg ${formatKg(i.peso_anterior_kg)} → ${formatKg(i.peso_nuevo_kg)}`)
    if (i.costo_pactado_nuevo !== i.costo_pactado_anterior || c.moneda_nueva !== c.moneda_anterior) {
      partes.push(
        `${formatMoneda(i.costo_pactado_anterior, c.moneda_anterior)}/kg → ${formatMoneda(i.costo_pactado_nuevo, c.moneda_nueva)}`
      )
    }
    if (i.costo_nuevo_usd_kg !== i.costo_anterior_usd_kg) {
      partes.push(`USD/kg ${formatUsd(i.costo_anterior_usd_kg)} → ${formatUsd(i.costo_nuevo_usd_kg)}`)
    }
    return `${i.lote_codigo ?? i.producto_nombre}: ${partes.join(' · ')}`
  })
}

/** «3 lotes procesados y 12 líneas de 5 facturas recalculadas». */
function textoPropagacion(c: CorreccionCompra): string | null {
  const p = c.propagacion
  const hijos = p.lotes.filter((l) => l.origen === 'proceso').length
  const partes: string[] = []
  if (hijos > 0) partes.push(`${hijos} ${hijos === 1 ? 'lote procesado' : 'lotes procesados'}`)
  if (p.lineas_factura > 0) {
    partes.push(
      `${p.lineas_factura} ${p.lineas_factura === 1 ? 'línea' : 'líneas'} de ${p.facturas} ${p.facturas === 1 ? 'factura' : 'facturas'}`
    )
  }
  if (partes.length === 0) return null
  // Concuerda con el último sustantivo: «… y 12 líneas de 5 facturas recalculadas».
  const sufijo =
    p.lineas_factura > 0 ? (p.lineas_factura === 1 && hijos === 0 ? 'recalculada' : 'recalculadas') : hijos === 1 ? 'recalculado' : 'recalculados'
  return `${partes.join(' y ')} ${sufijo}`
}

/**
 * Historial de ediciones de una compra (19, solo admin): fecha y hora,
 * usuario, motivo, cambios de cabecera y de líneas antes → después, total y
 * pagado antes → después, propagación del costo y contrato afectado.
 */
export function HistorialCorreccionesCompra({ correcciones }: { correcciones: readonly CorreccionCompra[] }) {
  if (correcciones.length === 0) {
    return <EmptyState compact icon={<HistoryOutlinedIcon fontSize="large" />} title="Sin ediciones" />
  }
  return (
    <List disablePadding aria-label="Historial de ediciones">
      {correcciones.map((c, idx) => {
        const cabecera = cambiosCabecera(c)
        const lineas = cambiosLineas(c)
        const propagacion = textoPropagacion(c)
        const aFavor = Math.round((c.pagado_nuevo_usd - c.subtotal_nuevo_usd) * 1e6) / 1e6
        return (
          <ListItem key={c.id} disableGutters divider={idx < correcciones.length - 1} sx={{ display: 'block', py: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {cabecera.length > 0 ? cabecera.join(' · ') : 'Líneas'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFechaHora(c.created_at)} · {c.usuario_nombre ?? 'Usuario'}
              </Typography>
            </Box>
            {lineas.map((t) => (
              <Typography key={t} variant="body2" color="text.secondary" sx={{ ...NUM, overflowWrap: 'anywhere' }}>
                {t}
              </Typography>
            ))}
            <Typography variant="body2" color="text.secondary" sx={NUM}>
              Total {formatUsd(c.subtotal_anterior_usd)} → {formatUsd(c.subtotal_nuevo_usd)} · pagado{' '}
              {formatUsd(c.pagado_anterior_usd)} → {formatUsd(c.pagado_nuevo_usd)}
              {c.estado_nuevo !== c.estado_anterior ? ` · pasa a ${c.estado_nuevo}` : ''}
              {aFavor > 0 ? ` · saldo a favor ${formatUsd(aFavor)}` : ''}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
              Motivo: {c.motivo}
            </Typography>
            {propagacion || c.contrato_id ? (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                {propagacion ? <Chip size="small" variant="soft" color="info" label={propagacion} /> : null}
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
        )
      })}
    </List>
  )
}
