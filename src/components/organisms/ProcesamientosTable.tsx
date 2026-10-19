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
import { formatFecha, formatKg, formatPct, formatUsd } from '@/lib/format'

const NUM = { fontVariantNumeric: 'tabular-nums' }

/** Una salida del procesamiento con su lote hijo. */
export interface SalidaFila {
  id: string
  producto_nombre: string
  peso_salida_kg: number
  lote_destino_id: string | null
  lote_destino_codigo: string | null
  /** Costo/kg del lote hijo; `null` para el operador (llega así de la base). */
  costo_usd_kg: number | null
}

/** Un procesamiento (16): un lote crudo → N salidas. */
export interface ProcesoFila {
  id: string
  fecha: string
  notas: string | null
  origen_nombre: string
  lote_origen_id: string | null
  lote_origen_codigo: string | null
  peso_entrada_kg: number
  salida_total_kg: number
  salidas: SalidaFila[]
  /** Costo total de la entrada; `null` para el operador. */
  costo_total_usd: number | null
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

/** Celda con contenido de varias líneas (`getRowHeight` automático). */
const celda = { py: 1, display: 'grid', gap: 0.5, alignContent: 'center', minHeight: '100%' }

/**
 * Listado de procesamientos (16): una fila por procesamiento con su lote
 * crudo, la entrada, sus N salidas (producto, kg y lote hijo) y la merma y
 * el rendimiento del proceso completo. Los costos (total y costo/kg de cada
 * salida) solo se muestran a un admin. La búsqueda rápida encuentra por
 * producto o código de lote de cualquier salida.
 */
export function ProcesamientosTable({ filas, esAdmin, onNuevo }: ProcesamientosTableProps) {
  const theme = useTheme()
  const compacto = useMediaQuery(theme.breakpoints.down('sm'))

  const columns: GridColDef<ProcesoFila>[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 110,
      valueFormatter: (v: string) => formatFecha(v),
    },
    {
      field: 'origen',
      headerName: 'Crudo · lote',
      flex: 1,
      minWidth: 170,
      valueGetter: (_v, row) => `${row.origen_nombre} ${row.lote_origen_codigo ?? ''}`,
      renderCell: ({ row }) => (
        <Box sx={celda}>
          <Typography variant="body2">{row.origen_nombre}</Typography>
          {row.lote_origen_codigo ? (
            <Box>
              <LoteChip
                codigo={row.lote_origen_codigo}
                href={row.lote_origen_id ? `/inventario/lotes/${row.lote_origen_id}` : undefined}
              />
            </Box>
          ) : null}
        </Box>
      ),
    },
    {
      field: 'peso_entrada_kg',
      headerName: 'Entrada',
      type: 'number',
      width: 110,
      renderCell: (params) => kg(Number(params.value)),
    },
    {
      field: 'salidas',
      headerName: 'Salidas',
      flex: 2,
      minWidth: 260,
      sortable: false,
      // Texto para la búsqueda rápida: productos y códigos de lote.
      valueGetter: (_v, row) =>
        row.salidas.map((s) => `${s.producto_nombre} ${s.lote_destino_codigo ?? ''}`).join(' '),
      renderCell: ({ row }) => (
        <Box component="ul" sx={{ ...celda, listStyle: 'none', m: 0, pl: 0 }}>
          {row.salidas.map((s) => (
            <Box
              component="li"
              key={s.id}
              sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1, rowGap: 0.25 }}
            >
              <Typography variant="body2" sx={NUM}>
                {s.producto_nombre} {formatKg(s.peso_salida_kg)}
              </Typography>
              {s.lote_destino_codigo ? (
                <LoteChip
                  codigo={s.lote_destino_codigo}
                  href={s.lote_destino_id ? `/inventario/lotes/${s.lote_destino_id}` : undefined}
                />
              ) : null}
              {esAdmin && s.costo_usd_kg != null ? (
                <Typography variant="caption" color="text.secondary" sx={NUM}>
                  {formatUsd(s.costo_usd_kg)}/kg
                </Typography>
              ) : null}
            </Box>
          ))}
        </Box>
      ),
    },
    {
      field: 'salida_total_kg',
      headerName: 'Σ salida',
      type: 'number',
      width: 110,
      renderCell: (params) => kg(Number(params.value)),
    },
    {
      field: 'merma_kg',
      headerName: 'Merma',
      type: 'number',
      width: 110,
      valueGetter: (_v, row) => Math.round((row.peso_entrada_kg - row.salida_total_kg) * 1000) / 1000,
      renderCell: (params) => kg(params.value),
    },
    {
      field: 'rendimiento',
      headerName: 'Rendimiento',
      type: 'number',
      width: 115,
      valueGetter: (_v, row) =>
        row.peso_entrada_kg > 0 ? row.salida_total_kg / row.peso_entrada_kg : 0,
      renderCell: (params) => (
        <Typography variant="body2" sx={NUM}>
          {formatPct(params.value)}
        </Typography>
      ),
    },
    ...(esAdmin
      ? ([
          {
            field: 'costo_total_usd',
            headerName: 'Costo total',
            type: 'number',
            width: 120,
            renderCell: (params) => (
              <Typography variant="body2" sx={NUM}>
                {params.value == null ? '—' : formatUsd(Number(params.value))}
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
        description="Pesa un lote crudo a la entrada y lo que sale de él: filete, cabeza, piel… Cada salida nace como un lote propio."
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
      getRowHeight={() => 'auto'}
      disableRowSelectionOnClick
      pageSizeOptions={[10, 25, 50]}
      initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
      columnVisibilityModel={
        compacto ? { peso_entrada_kg: false, merma_kg: false, notas: false } : {}
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
