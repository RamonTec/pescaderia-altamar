'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { DataGrid, type GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid'
import { EmptyState } from '@/components/molecules/EmptyState'
import { formatFecha, formatUsd } from '@/lib/format'
import type { NotaCreditoResumen } from '@/lib/repositories/interfaces'

const MONO = { fontFamily: 'var(--font-geist-mono)', fontVariantNumeric: 'tabular-nums' }

export interface NotasCreditoTableProps {
  notas: NotaCreditoResumen[]
  esAdmin: boolean
  onAnular: (nota: NotaCreditoResumen) => void
}

export function NotasCreditoTable({ notas, esAdmin, onAnular }: NotasCreditoTableProps) {
  const columns: GridColDef<NotaCreditoResumen>[] = [
    {
      field: 'numero',
      headerName: 'N.º',
      width: 90,
      renderCell: (params) => (
        <Typography variant="body2" sx={MONO}>
          {params.row.numero}
        </Typography>
      ),
    },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 120,
      valueFormatter: (v: string) => formatFecha(v),
    },
    {
      field: 'factura',
      headerName: 'Factura',
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => `${row.factura.numero} · ${row.factura.cliente.nombre}`,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">
            Factura N.º {params.row.factura.numero}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.factura.cliente.nombre}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'motivo',
      headerName: 'Motivo',
      flex: 1,
      minWidth: 160,
    },
    {
      field: 'total_usd',
      headerName: 'Total',
      type: 'number',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2" sx={MONO}>
          {formatUsd(Number(params.row.total_usd))}
        </Typography>
      ),
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.estado === 'emitida' ? 'Emitida' : 'Anulada'}
          size="small"
          color={params.row.estado === 'emitida' ? 'success' : 'default'}
          variant="outlined"
        />
      ),
    },
    ...(esAdmin
      ? ([
          {
            field: 'acciones',
            headerName: '',
            sortable: false,
            filterable: false,
            width: 110,
            renderCell: (params) =>
              params.row.estado === 'emitida' ? (
                <Button size="small" color="error" onClick={() => onAnular(params.row)}>
                  Anular
                </Button>
              ) : null,
          },
        ] satisfies GridColDef<NotaCreditoResumen>[])
      : []),
  ]

  if (notas.length === 0) {
    return (
      <EmptyState
        title="Aún no hay notas de crédito"
        description="Las devoluciones y correcciones sobre facturas emitidas aparecerán aquí."
      />
    )
  }

  return (
    <DataGrid
      rows={notas}
      columns={columns}
      autoHeight
      disableRowSelectionOnClick
      pageSizeOptions={[10, 25, 50]}
      initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
      slots={{
        toolbar: () => <GridToolbarQuickFilter debounceMs={250} />,
        noRowsOverlay: () => (
          <EmptyState title="Sin resultados" description="No hay notas que coincidan." />
        ),
      }}
      sx={{ bgcolor: 'background.paper' }}
    />
  )
}
