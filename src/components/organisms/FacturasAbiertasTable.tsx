'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { DataGrid, type GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid'
import { EmptyState } from '@/components/molecules/EmptyState'
import { formatFecha, formatUsd } from '@/lib/format'
import type { FacturaResumen } from '@/lib/repositories/interfaces'

const NUM = { fontVariantNumeric: 'tabular-nums' }

export interface FacturasAbiertasTableProps {
  facturas: FacturaResumen[]
  esAdmin: boolean
  onPagar: (factura: FacturaResumen) => void
}

export function FacturasAbiertasTable({ facturas, esAdmin, onPagar }: FacturasAbiertasTableProps) {
  const columns: GridColDef<FacturaResumen>[] = [
    {
      field: 'numero',
      headerName: 'N.º',
      width: 90,
      renderCell: (params) => (
        <Typography variant="body2" sx={NUM}>
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
      field: 'condicion',
      headerName: 'Condición',
      width: 110,
      valueFormatter: (v: string) => (v === 'credito' ? 'Crédito' : 'Contado'),
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.estado === 'abierta' ? 'Por cobrar' : 'Pagada'}
          size="small"
          color={params.row.estado === 'abierta' ? 'warning' : 'success'}
          variant="outlined"
        />
      ),
    },
    ...(esAdmin
      ? ([
          {
            field: 'total_usd',
            headerName: 'Total',
            type: 'number',
            width: 130,
            renderCell: (params) => (
              <Typography variant="body2" sx={NUM}>
                {formatUsd(Number(params.row.total_usd))}
              </Typography>
            ),
          },
          {
            field: 'saldo',
            headerName: 'Saldo',
            type: 'number',
            width: 130,
            valueGetter: (_v, row) => Number(row.total_usd) - Number(row.pagado_usd),
            renderCell: (params) => (
              <Typography
                variant="body2"
                sx={NUM}
                color={params.value > 0 ? 'text.primary' : 'text.secondary'}
              >
                {formatUsd(params.value)}
              </Typography>
            ),
          },
          {
            field: 'acciones',
            headerName: '',
            sortable: false,
            filterable: false,
            width: 110,
            renderCell: (params) =>
              params.row.estado === 'abierta' ? (
                <Button size="small" onClick={() => onPagar(params.row)}>
                  Cobrar
                </Button>
              ) : null,
          },
        ] satisfies GridColDef<FacturaResumen>[])
      : []),
  ]

  if (facturas.length === 0) {
    return (
      <EmptyState
        title="No hay facturas por cobrar"
        description="Las ventas a crédito aparecerán aquí para registrar sus abonos."
      />
    )
  }

  return (
    <DataGrid
      rows={facturas}
      columns={columns}
      autoHeight
      disableRowSelectionOnClick
      pageSizeOptions={[10, 25, 50]}
      initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
      slots={{
        toolbar: () => <GridToolbarQuickFilter debounceMs={250} />,
        noRowsOverlay: () => (
          <EmptyState title="Sin resultados" description="No hay facturas que coincidan." />
        ),
      }}
      sx={{ bgcolor: 'background.paper' }}
    />
  )
}
