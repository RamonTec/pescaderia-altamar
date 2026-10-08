'use client'

import * as React from 'react'
import Link from 'next/link'
import Button from '@mui/material/Button'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ListaResumen } from '@/components/molecules/ListaResumen'
import { EstadoChip } from './appDataGridColumns'
import type { BloqueDashboard, Deudor } from '@/types/domain'
import { formatEntero, formatUsd } from '@/lib/format'

/**
 * Principales deudores (15, C2): clientes por saldo USD (mismo saldo que la
 * cartera de 09), vencido y días de la vencida más antigua; enlace a la ficha.
 */
export function TopDeudoresList({ deudores }: { deudores: BloqueDashboard<Deudor[]> }) {
  const filas = deudores.ok ? deudores.data : []
  return (
    <ChartCard
      title="Principales deudores"
      help="Por saldo pendiente a hoy."
      error={deudores.ok ? null : deudores.error}
      empty={filas.length === 0}
      emptyTitle="Ningún cliente tiene saldo pendiente"
      skeletonHeight={280}
      action={
        <Button component={Link} href="/cobros" size="small">
          Ver cobros
        </Button>
      }
    >
      <ListaResumen
        ariaLabel="Principales deudores"
        filas={filas.map((d) => ({
          id: d.cliente_id,
          href: `/clientes/${d.cliente_id}`,
          primary: d.cliente_nombre,
          secondary: `${formatEntero(d.facturas)} ${d.facturas === 1 ? 'factura' : 'facturas'}${
            d.vencido_usd > 0.005 ? ` · vencido ${formatUsd(d.vencido_usd)}` : ''
          }`,
          amount: formatUsd(d.saldo_usd),
          status:
            d.vencida_mas_antigua_dias !== null ? (
              <EstadoChip label={`Vencida ${d.vencida_mas_antigua_dias} d`} color="error" />
            ) : (
              <EstadoChip label="Al día" color="success" />
            ),
        }))}
      />
    </ChartCard>
  )
}
