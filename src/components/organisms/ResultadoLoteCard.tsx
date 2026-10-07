'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { FichaSeccion } from '@/components/molecules/FichaSeccion'
import { formatBs, formatKg, formatTasa, formatUsd } from '@/lib/format'
import type { ResultadoLote } from '@/types/domain'

const pct = new Intl.NumberFormat('es-VE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const NUM = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

function Fila({
  label,
  valor,
  destacado,
  color,
}: {
  label: string
  valor: string
  destacado?: boolean
  color?: string
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'baseline' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant={destacado ? 'h6' : 'body2'} sx={NUM} color={color}>
        {valor}
      </Typography>
    </Box>
  )
}

const signo = (n: number) => (n < 0 ? 'error.main' : undefined)

export interface ResultadoLoteCardProps {
  resultado: ResultadoLote
  /** Tasa de compra del lote (Bs por USD). */
  tasaCompra: number
  /** El lote crudo consolida a sus hijos procesados. */
  consolidado: boolean
}

/**
 * Resultado de un lote (solo admin, 07-lotes) para los kg vendidos y
 * perdidos: en USD, en Bs a tasas históricas (ventas a la tasa de cada
 * factura, costos a la tasa de compra) y el efecto cambiario (cuánto del
 * resultado en Bs se debe al cambio de tasa entre la compra y la venta).
 */
export function ResultadoLoteCard({ resultado: r, tasaCompra, consolidado }: ResultadoLoteCardProps) {
  return (
    <FichaSeccion titulo={consolidado ? 'Resultado del lote y sus procesados' : 'Resultado del lote'}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Fila label="Kg vendidos" valor={formatKg(r.kgVendidos)} />
        <Fila label="Kg perdidos" valor={formatKg(r.kgPerdidos)} />
        {r.rendimiento != null ? (
          <Fila
            label="Merma de procesamiento"
            valor={`${formatKg(r.mermaKg)} · rendimiento ${pct.format(r.rendimiento)}`}
          />
        ) : null}
        <Divider sx={{ my: 0.5 }} />
        <Fila label="Ingreso (sin IVA)" valor={formatUsd(r.ingresoUsd)} />
        <Fila label="Costo vendido" valor={`− ${formatUsd(r.costoVendidoUsd)}`} />
        <Fila label="Costo perdido" valor={`− ${formatUsd(r.costoPerdidoUsd)}`} />
        <Fila label="Resultado USD" valor={formatUsd(r.resultadoUsd)} destacado color={signo(r.resultadoUsd)} />
        <Divider sx={{ my: 0.5 }} />
        <Fila
          label="Resultado Bs (tasas históricas)"
          valor={formatBs(r.resultadoBs)}
          destacado
          color={signo(r.resultadoBs)}
        />
        <Fila
          label={`Efecto cambiario (vs. tasa de compra ${formatTasa(tasaCompra)})`}
          valor={formatBs(r.efectoCambiarioBs)}
          color={signo(r.efectoCambiarioBs)}
        />
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: '75ch' }}>
          Ventas a la tasa de cada factura y costos a la tasa de compra del lote. No incluye la
          ganancia cambiaria de los cobros, que depende de cuándo paga el cliente (ver Cobros).
        </Typography>
      </Box>
    </FichaSeccion>
  )
}
