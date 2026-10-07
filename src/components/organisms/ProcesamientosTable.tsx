'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid'
import { EmptyState } from '@/components/molecules/EmptyState'
import { LoteChip } from '@/components/molecules/LoteChip'
import { formatFecha, formatKg, formatUsd } from '@/lib/format'
import type { ProcesoItemDetalle } from '@/lib/repositories/interfaces'

const NUM = { fontVariantNumeric: 'tabular-nums' }

const pctFormatter = new Intl.NumberFormat('es-VE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Un lote procesado. Para el operador `costo_total_usd` llega en `null`. */
export interface ProcesoFila {
  id: string
  fecha: string
  notas: string | null
  origen: ProcesoItemDetalle['origen']
  destino: ProcesoItemDetalle['destino']
  peso_entrada_kg: number
  peso_salida_kg: number
  costo_total_usd: number | null
  /** Lote crudo de origen y lote procesado generado (07-lotes). */
  lote_origen_codigo: string | null
  lote_destino_codigo: string | null
}

export interface ProcesamientosTableProps {
  filas: ProcesoFila[]
  esAdmin: boolean
  onNuevo: () => void
}

const kg = (n: number) => (
  <Typography variant="body2" sx={NUM}>
    {formatKg(n)}
  </Typography>
)

export function ProcesamientosTable({ filas, esAdmin, onNuevo }: ProcesamientosTableProps) {
  const theme = useTheme()
  const compacto = useMediaQuery(theme.breakpoints.down('sm'))

  const columns: GridColDef<ProcesoFila>[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 120,
      valueFormatter: (v: string) => formatFecha(v),
    },
    {
      field: 'producto',
      headerName: 'Crudo → procesado',
      flex: 1.5,
      minWidth: 200,
      valueGetter: (_v, row) => `${row.origen.nombre} → ${row.destino.nombre}`,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">{params.row.destino.nombre}</Typography>
          <Typography variant="caption" color="text.secondary">
            de {params.row.origen.nombre}
            {params.row.lote_origen_codigo ? ` · ${params.row.lote_origen_codigo}` : ''}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'lote_destino_codigo',
      headerName: 'Lotes',
      flex: 1.2,
      minWidth: 180,
      valueGetter: (_v, row) => `${row.lote_origen_codigo ?? ''} ${row.lote_destino_codigo ?? ''}`,
      renderCell: (params) =>
        params.row.lote_destino_codigo ? (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <LoteChip codigo={params.row.lote_destino_codigo} />
          </Box>
        ) : null,
    },
    {
      field: 'peso_entrada_kg',
      headerName: 'Entrada',
      type: 'number',
      width: 120,
      renderCell: (params) => kg(Number(params.value)),
    },
    {
      field: 'peso_salida_kg',
      headerName: 'Salida',
      type: 'number',
      width: 120,
      renderCell: (params) => kg(Number(params.value)),
    },
    {
      field: 'merma_kg',
      headerName: 'Merma',
      type: 'number',
      width: 130,
      valueGetter: (_v, row) => Number(row.peso_entrada_kg) - Number(row.peso_salida_kg),
      renderCell: (params) => kg(params.value),
    },
    {
      field: 'rendimiento',
      headerName: 'Rendimiento',
      type: 'number',
      width: 120,
      valueGetter: (_v, row) => Number(row.peso_salida_kg) / Number(row.peso_entrada_kg),
      renderCell: (params) => (
        <Typography variant="body2" sx={NUM}>
          {pctFormatter.format(params.value)}
        </Typography>
      ),
    },
    ...(esAdmin
      ? ([
          {
            field: 'costo_kg_destino',
            headerName: 'Costo/kg procesado',
            type: 'number',
            width: 160,
            // Transferencia total (/SPEC.md §4.3): costo del lote / kg obtenidos.
            valueGetter: (_v, row) => Number(row.costo_total_usd) / Number(row.peso_salida_kg),
            renderCell: (params) => (
              <Typography variant="body2" sx={NUM}>
                {formatUsd(params.value)}
              </Typography>
            ),
          },
        ] satisfies GridColDef<ProcesoFila>[])
      : []),
    {
      field: 'notas',
      headerName: 'Notas',
      flex: 1,
      minWidth: 140,
      valueFormatter: (v: string | null) => v ?? '',
    },
  ]

  if (filas.length === 0) {
    return (
      <EmptyState
        title="Registra tu primer procesamiento"
        description="Cada lote pasa el crudo pesado a producto limpio y le transfiere todo su costo."
        action={
          <Button variant="contained" onClick={onNuevo}>
            Nuevo procesamiento
          </Button>
        }
      />
    )
  }

  return (
    <DataGrid
      rows={filas}
      columns={columns}
      autoHeight
      disableRowSelectionOnClick
      pageSizeOptions={[10, 25, 50]}
      initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
      columnVisibilityModel={
        compacto
          ? { peso_entrada_kg: false, merma_kg: false, notas: false, lote_destino_codigo: false }
          : {}
      }
      slots={{
        toolbar: () => <GridToolbarQuickFilter debounceMs={250} />,
        noRowsOverlay: () => (
          <EmptyState title="Sin resultados" description="No hay procesamientos que coincidan." />
        ),
      }}
      sx={{ bgcolor: 'background.paper' }}
    />
  )
}
