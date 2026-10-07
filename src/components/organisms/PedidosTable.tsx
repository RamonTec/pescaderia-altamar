'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { type GridColDef } from '@mui/x-data-grid'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { colAcciones, colEstado, colFecha, type EstadoDef } from '@/components/organisms/appDataGridColumns'
import { formatFecha } from '@/lib/format'
import type { PedidoResumen } from '@/lib/repositories/interfaces'
import type { EstadoPedido } from '@/types/domain'

const ESTADO: Record<EstadoPedido, EstadoDef> = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  entregado: { label: 'Entregado', color: 'success' },
  facturado: { label: 'Facturado', color: 'success' },
  anulado: { label: 'Anulado', color: 'default' },
}

export interface PedidosTableProps {
  pedidos: PedidoResumen[]
  total: number
  onEntregar: (pedido: PedidoResumen) => void
  onAnular: (pedido: PedidoResumen) => void
  onNuevo: () => void
}

function EstadoFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('estado') || 'todos'

  const handleChange = (_: React.MouseEvent<HTMLElement>, newEstado: string | null) => {
    if (!newEstado) return
    const params = new URLSearchParams(searchParams.toString())
    if (newEstado === 'todos') {
      params.delete('estado')
    } else {
      params.set('estado', newEstado)
    }
    params.delete('pagina') // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={current}
      onChange={handleChange}
      aria-label="Filtrar por estado"
    >
      <ToggleButton value="todos">Todos</ToggleButton>
      <ToggleButton value="pendiente">Pendientes</ToggleButton>
    </ToggleButtonGroup>
  )
}

export function PedidosTable({ pedidos, total, onEntregar, onAnular, onNuevo }: PedidosTableProps) {
  const columns: GridColDef<PedidoResumen>[] = React.useMemo(() => [
    colFecha('fecha', 'Fecha', { width: 120 }),
    {
      field: 'cliente',
      headerName: 'Cliente',
      flex: 1.5,
      minWidth: 180,
      valueGetter: (_v, row) => row.cliente?.nombre ?? '—',
      renderCell: (params) => (
        <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
          <Typography variant="body2">{params.row.cliente?.nombre ?? '—'}</Typography>
          {params.row.cliente?.rif_ci ? (
            <Typography variant="caption" color="text.secondary">
              {params.row.cliente.rif_ci}
            </Typography>
          ) : null}
        </Box>
      ),
    },
    {
      field: 'fecha_entrega',
      headerName: 'Entrega',
      width: 120,
      valueFormatter: (v: string | null) => formatFecha(v),
    },
    colEstado('estado', 'Estado', ESTADO, { width: 130 }),
    colAcciones((row) => {
      const actions = []
      if (row.estado === 'pendiente') {
        actions.push({
          label: 'Entregar',
          onClick: () => onEntregar(row),
        })
        actions.push({
          label: 'Anular',
          onClick: () => onAnular(row),
          color: 'error' as const,
        })
      }
      return actions
    }, { rowLabel: (row) => `pedido de ${row.cliente?.nombre}` }),
  ], [onEntregar, onAnular])

  return (
    <AppDataGrid<PedidoResumen>
      tableId="pedidos"
      label="Pedidos"
      mode="server"
      rows={pedidos}
      rowCount={total}
      columns={columns}
      filters={<EstadoFilter />}
      searchPlaceholder="Buscar por cliente o documento..."
      emptyState={{
        title: 'Registra tu primera venta o pedido',
        description: 'Una venta directa se pesa y factura al instante; un pedido agendado queda pendiente de entrega.',
        action: <Button variant="contained" onClick={onNuevo}>Nueva venta / pedido</Button>,
      }}
      mobileCard={(row) => {
        return {
          primary: row.cliente?.nombre ?? '—',
          secondary: `Pedido del ${formatFecha(row.fecha)}`,
          amount: null,
          status: row.estado,
          statusColors: ESTADO,
        }
      }}
    />
  )
}
