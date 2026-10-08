'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import { ChartCard } from '@/components/molecules/ChartCard'
import type { BloqueDashboard, DashboardOperativo, GrupoPedidoProximo } from '@/types/domain'
import { ETIQUETA_GRUPO_PEDIDO } from '@/lib/dashboard/etiquetas'
import { formatFecha, formatKg, formatUsd } from '@/lib/format'

const COLOR_GRUPO: Record<GrupoPedidoProximo, 'error' | 'primary' | 'default'> = {
  atrasado: 'error',
  hoy: 'primary',
  manana: 'default',
}

/**
 * Pedidos agendados (15, agregado 13): `pendiente` con entrega hoy, mañana o
 * atrasada. Cliente, ítems, kg estimados y fecha; el admin ve además el USD
 * estimado. Enlace a `/pedidos`.
 */
export function PedidosProximosList({ operativo }: { operativo: BloqueDashboard<DashboardOperativo> }) {
  const pedidos = operativo.ok ? operativo.data.pedidos : []
  return (
    <ChartCard
      title="Pedidos de hoy y mañana"
      help="Pendientes de entregar, con los atrasados primero."
      error={operativo.ok ? null : operativo.error}
      empty={pedidos.length === 0}
      emptyTitle="No hay pedidos pendientes para hoy ni mañana"
      action={
        <Button component={Link} href="/pedidos" size="small">
          Ver pedidos
        </Button>
      }
    >
      <List disablePadding aria-label="Pedidos próximos">
        {pedidos.map((p, i) => (
          <ListItem
            key={p.pedido_id}
            divider={i < pedidos.length - 1}
            disableGutters
            sx={{ minHeight: 56, gap: 1.5, alignItems: 'center' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                {p.cliente_nombre}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatFecha(p.fecha_entrega)} · {p.items} {p.items === 1 ? 'ítem' : 'ítems'} · {formatKg(p.kg_estimados)}
              </Typography>
            </Box>
            {p.usd_estimado !== null ? (
              <Typography
                variant="body2"
                sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}
              >
                {formatUsd(p.usd_estimado)}
              </Typography>
            ) : null}
            <Chip size="small" variant="soft" color={COLOR_GRUPO[p.grupo]} label={ETIQUETA_GRUPO_PEDIDO[p.grupo]} />
          </ListItem>
        ))}
      </List>
    </ChartCard>
  )
}
