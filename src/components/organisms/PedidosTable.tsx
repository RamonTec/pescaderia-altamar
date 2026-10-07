'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { DataGrid, type GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid'
import { EmptyState } from '@/components/molecules/EmptyState'
import { formatFecha } from '@/lib/format'
import type { PedidoResumen } from '@/lib/repositories/interfaces'
import type { EstadoPedido } from '@/types/domain'

const ESTADO: Record<EstadoPedido, { label: string; color: 'warning' | 'success' | 'default' }> = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  entregado: { label: 'Entregado', color: 'success' },
  facturado: { label: 'Facturado', color: 'success' },
  anulado: { label: 'Anulado', color: 'default' },
}

type Filtro = 'pendientes' | 'todos'

export interface PedidosTableProps {
  pedidos: PedidoResumen[]
  onEntregar: (pedido: PedidoResumen) => void
  onAnular: (pedido: PedidoResumen) => void
  onNuevo: () => void
}

export function PedidosTable({ pedidos, onEntregar, onAnular, onNuevo }: PedidosTableProps) {
  const [filtro, setFiltro] = React.useState<Filtro>('todos')
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente')
  const filas = filtro === 'pendientes' ? pendientes : pedidos

  const columns: GridColDef<PedidoResumen>[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 120,
      valueFormatter: (v: string) => formatFecha(v),
    },
    {
      field: 'cliente',
      headerName: 'Cliente',
      flex: 1.5,
      minWidth: 180,
      valueGetter: (_v, row) => row.cliente?.nombre ?? '—',
      renderCell: (params) => (
        <Box>
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
    {
      field: 'estado',
      headerName: 'Estado',
      width: 130,
      renderCell: (params) => {
        const e = ESTADO[params.row.estado]
        return <Chip label={e.label} size="small" color={e.color} variant="outlined" />
      },
    },
    {
      field: 'acciones',
      headerName: '',
      sortable: false,
      filterable: false,
      width: 200,
      renderCell: (params) =>
        params.row.estado === 'pendiente' ? (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => onEntregar(params.row)}>
              Entregar
            </Button>
            <Button size="small" color="error" onClick={() => onAnular(params.row)}>
              Anular
            </Button>
          </Box>
        ) : null,
    },
  ]

  if (pedidos.length === 0) {
    return (
      <EmptyState
        title="Registra tu primera venta o pedido"
        description="Una venta directa se pesa y factura al instante; un pedido agendado queda pendiente de entrega."
        action={
          <Button variant="contained" onClick={onNuevo}>
            Nueva venta / pedido
          </Button>
        }
      />
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={filtro}
        onChange={(_, next: Filtro | null) => next && setFiltro(next)}
        aria-label="Filtrar pedidos"
        sx={{ justifySelf: 'start' }}
      >
        <ToggleButton value="todos">Todos ({pedidos.length})</ToggleButton>
        <ToggleButton value="pendientes">Pendientes ({pendientes.length})</ToggleButton>
      </ToggleButtonGroup>

      <DataGrid
        rows={filas}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        slots={{
          toolbar: () => <GridToolbarQuickFilter debounceMs={250} />,
          noRowsOverlay: () => (
            <EmptyState title="Sin resultados" description="No hay pedidos que coincidan." />
          ),
        }}
        sx={{ bgcolor: 'background.paper' }}
      />
    </Box>
  )
}
