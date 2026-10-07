'use client'

import * as React from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { formatHace, formatUsd } from '@/lib/format'
import { nivelCartera, type NivelCartera } from '@/lib/cartera/resumen'
import type { CanalRecordatorioId, ResumenCartera } from '@/lib/cartera/types'

const ETIQUETA_CANAL: Record<CanalRecordatorioId, string> = {
  whatsapp: 'WhatsApp',
  email: 'correo',
}

const COLOR_NIVEL: Record<NivelCartera, string> = {
  vencida: 'error.main',
  pendiente: 'warning.main',
  al_dia: 'text.secondary',
  sin_documentos: 'text.disabled',
}

function dias(n: number) {
  return `${n} ${n === 1 ? 'día' : 'días'}`
}

interface Lineas {
  conteos: string
  vencidas: string | null
  montos: string | null
  recordatorio: string | null
}

function lineas(r: ResumenCartera): Lineas {
  const c = r.conteo
  const vencidas =
    c.vencida > 0
      ? `Vencidas ${c.vencida}${
          r.vencida_mas_antigua_dias !== null ? ` (hace ${dias(r.vencida_mas_antigua_dias)})` : ''
        }`
      : null
  return {
    conteos: `Pagadas ${c.pagada} · Pendientes ${c.pendiente} · Por vencer ${c.por_vencer}`,
    vencidas,
    montos:
      r.saldo_usd !== null
        ? `Saldo ${formatUsd(r.saldo_usd)} · Vencido ${formatUsd(r.saldo_vencido_usd ?? 0)}`
        : null,
    recordatorio: r.ultimo_recordatorio
      ? `Último recordatorio: ${ETIQUETA_CANAL[r.ultimo_recordatorio.canal]}, ${formatHace(
          r.ultimo_recordatorio.fecha
        )}`
      : null,
  }
}

export interface CarteraIndicadorProps {
  /** `null`: sin facturas (o sin datos de cartera). */
  resumen: ResumenCartera | null
  /** Sustantivo del documento en el texto accesible ("facturas", "compras"). */
  documentos?: string
}

/**
 * Indicador de cartera de una contraparte (09-cuentas-por-cobrar): ícono
 * `ReceiptLongOutlined` con badge, coloreado por el peor estado (rojo con
 * vencidas, ámbar con pendientes/por vencer, neutro sin deuda, atenuado sin
 * documentos). Tooltip con conteos, montos (solo si el resumen los trae) y
 * último recordatorio; también al foco del teclado y al tocar
 * (`enterTouchDelay={0}`). El clic no abre la fila (`stopPropagation`).
 */
export function CarteraIndicador({ resumen, documentos = 'facturas' }: CarteraIndicadorProps) {
  const nivel: NivelCartera = resumen ? nivelCartera(resumen) : 'sin_documentos'
  const l = resumen ? lineas(resumen) : null
  const badge =
    nivel === 'vencida'
      ? resumen!.conteo.vencida
      : nivel === 'pendiente'
        ? resumen!.conteo.pendiente + resumen!.conteo.por_vencer
        : 0

  const ariaLabel = l
    ? [l.conteos, l.vencidas, l.montos, l.recordatorio].filter(Boolean).join('. ')
    : `Sin ${documentos}`

  const titulo = l ? (
    <Box sx={{ display: 'grid', gap: 0.25, py: 0.25 }}>
      <span>
        {l.conteos}
        {l.vencidas ? (
          <>
            {' · '}
            <strong>{l.vencidas}</strong>
          </>
        ) : null}
      </span>
      {l.montos ? <span>{l.montos}</span> : null}
      {l.recordatorio ? <span>{l.recordatorio}</span> : null}
    </Box>
  ) : (
    `Sin ${documentos}`
  )

  const detener = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <Tooltip title={titulo} enterTouchDelay={0} leaveTouchDelay={4000} arrow>
      <IconButton
        size="small"
        aria-label={ariaLabel}
        onClick={detener}
        onKeyDown={(e) => {
          // Enter/Espacio sobre el indicador no abren la ficha de la fila.
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
        }}
        sx={{ color: COLOR_NIVEL[nivel] }}
      >
        <Badge
          badgeContent={badge}
          color={nivel === 'vencida' ? 'error' : 'warning'}
          invisible={badge === 0}
          max={99}
        >
          <ReceiptLongOutlinedIcon fontSize="small" />
        </Badge>
      </IconButton>
    </Tooltip>
  )
}
