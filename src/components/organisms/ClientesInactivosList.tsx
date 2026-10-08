'use client'

import * as React from 'react'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ListaResumen } from '@/components/molecules/ListaResumen'
import type { BloqueDashboard, ClienteInactivo } from '@/types/domain'
import { formatEntero, formatFecha, formatUsd } from '@/lib/format'

/**
 * Clientes inactivos (15, C5): activos con compras y sin facturas en más de
 * `dias` días. Última compra, días y lo que compraron en sus últimos 90 días
 * de actividad; enlace a la ficha.
 */
export function ClientesInactivosList({ inactivos, dias }: { inactivos: BloqueDashboard<ClienteInactivo[]>; dias: number }) {
  const filas = inactivos.ok ? inactivos.data : []
  return (
    <ChartCard
      title="Clientes inactivos"
      help={`Sin compras hace más de ${dias} días.`}
      error={inactivos.ok ? null : inactivos.error}
      empty={filas.length === 0}
      emptyTitle={`Todos los clientes compraron en los últimos ${dias} días`}
      skeletonHeight={240}
    >
      <ListaResumen
        ariaLabel="Clientes inactivos"
        filas={filas.map((c) => ({
          id: c.cliente_id,
          href: `/clientes/${c.cliente_id}`,
          primary: c.cliente_nombre,
          secondary: `Última compra ${formatFecha(c.ultima_compra)} · hace ${formatEntero(c.dias)} días`,
          amount: formatUsd(c.ventas_90d_usd),
          amountDetail: '90 días previos',
        }))}
      />
    </ChartCard>
  )
}
