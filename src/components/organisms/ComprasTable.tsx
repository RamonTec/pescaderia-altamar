'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid'
import { EmptyState } from '@/components/molecules/EmptyState'
import { formatFecha, formatUsd } from '@/lib/format'
import type { CompraResumen } from '@/lib/repositories/interfaces'
import type { EstadoDoc } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' }

/** Para el operador los importes llegan en `null` (costos y balances son de admin). */
export type CompraFila = Omit<CompraResumen, 'subtotal_usd' | 'pagado_usd'> & {
  subtotal_usd: number | null
  pagado_usd: number | null
}

type Filtro = 'por_pagar' | 'todas'

const ESTADO: Record<EstadoDoc, { label: string; color: 'warning' | 'success' | 'default' }> = {
  abierta: { label: 'Por pagar', color: 'warning' },
  pagada: { label: 'Pagada', color: 'success' },
  anulada: { label: 'Anulada', color: 'default' },
}

export interface ComprasTableProps {
  compras: CompraFila[]
  esAdmin: boolean
  onPagar: (compra: CompraFila) => void
  onNueva: () => void
}

export function ComprasTable({ compras, esAdmin, onPagar, onNueva }: ComprasTableProps) {
  const theme = useTheme()
  const compacto = useMediaQuery(theme.breakpoints.down('sm'))
  const [filtro, setFiltro] = React.useState<Filtro>('todas')

  const porPagar = compras.filter((c) => c.estado === 'abierta')
  const filas = filtro === 'por_pagar' ? porPagar : compras

  const columns: GridColDef<CompraFila>[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 120,
      valueFormatter: (v: string) => formatFecha(v),
    },
    {
      field: 'proveedor',
      headerName: 'Proveedor',
      flex: 1.5,
      minWidth: 180,
      valueGetter: (_v, row) => row.proveedor?.nombre ?? '—',
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">{params.row.proveedor?.nombre ?? '—'}</Typography>
          {params.row.proveedor?.rif_ci ? (
            <Typography variant="caption" color="text.secondary">
              {params.row.proveedor.rif_ci}
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
      field: 'moneda',
      headerName: 'Moneda',
      width: 90,
      valueFormatter: (v: string) => v.toUpperCase(),
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      renderCell: (params) => {
        const e = ESTADO[params.row.estado]
        return <Chip label={e.label} size="small" color={e.color} variant="outlined" />
      },
    },
    ...(esAdmin
      ? ([
          {
            field: 'subtotal_usd',
            headerName: 'Total',
            type: 'number',
            width: 130,
            renderCell: (params) => (
              <Typography variant="body2" sx={NUM}>
                {formatUsd(Number(params.row.subtotal_usd))}
              </Typography>
            ),
          },
          {
            field: 'saldo',
            headerName: 'Saldo',
            type: 'number',
            width: 130,
            valueGetter: (_v, row) => Number(row.subtotal_usd) - Number(row.pagado_usd),
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
                  Pagar
                </Button>
              ) : null,
          },
        ] satisfies GridColDef<CompraFila>[])
      : []),
  ]

  if (compras.length === 0) {
    return (
      <EmptyState
        title="Registra tu primera compra"
        description="Cada compra suma el producto pesado al inventario con su costo por kg."
        action={
          <Button variant="contained" onClick={onNueva}>
            Nueva compra
          </Button>
        }
      />
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {esAdmin ? (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filtro}
          onChange={(_, next: Filtro | null) => next && setFiltro(next)}
          aria-label="Filtrar compras"
          sx={{ justifySelf: 'start' }}
        >
          <ToggleButton value="todas">Todas ({compras.length})</ToggleButton>
          <ToggleButton value="por_pagar">Por pagar ({porPagar.length})</ToggleButton>
        </ToggleButtonGroup>
      ) : null}

      <DataGrid
        rows={filas}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        columnVisibilityModel={
          compacto ? { condicion: false, moneda: false, subtotal_usd: false } : {}
        }
        slots={{
          toolbar: () => <GridToolbarQuickFilter debounceMs={250} />,
          noRowsOverlay: () => (
            <EmptyState title="Sin resultados" description="No hay compras que coincidan." />
          ),
        }}
        sx={{ bgcolor: 'background.paper' }}
      />
    </Box>
  )
}
