'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { type GridColDef } from '@mui/x-data-grid'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { colEstado, colFecha, colMonto, EstadoChip, type EstadoDef } from '@/components/organisms/appDataGridColumns'
import { formatUsd } from '@/lib/format'
import type { FacturaResumen } from '@/lib/repositories/interfaces'
import type { CondicionPago, EstadoDoc } from '@/types/domain'

const ESTADO: Record<EstadoDoc, EstadoDef> = {
  abierta: { label: 'Abierta', color: 'warning' },
  pagada: { label: 'Pagada', color: 'success' },
  anulada: { label: 'Anulada', color: 'default' },
}

const CONDICION: Record<CondicionPago, string> = {
  contado: 'Contado',
  credito: 'Crédito',
}

type FiltroCondicion = 'todas' | CondicionPago

export interface FacturasTableProps {
  facturas: FacturaResumen[]
}

/**
 * Listado de todas las facturas emitidas, de contado y de crédito, en
 * cualquier estado. `/cobros` solo muestra las abiertas: una factura de
 * contado nace pagada y no aparecía en ningún listado.
 */
export function FacturasTable({ facturas }: FacturasTableProps) {
  const [condicion, setCondicion] = React.useState<FiltroCondicion>('todas')

  const filas = React.useMemo(
    () => (condicion === 'todas' ? facturas : facturas.filter((f) => f.condicion === condicion)),
    [facturas, condicion]
  )

  const columns: GridColDef<FacturaResumen>[] = React.useMemo(() => [
    { field: 'numero', headerName: 'N.º', width: 90 },
    colFecha('fecha', 'Fecha', { width: 120 }),
    {
      field: 'cliente',
      headerName: 'Cliente',
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => row.cliente.nombre,
      renderCell: (params) => (
        <Box sx={{ display: 'grid', alignContent: 'center', height: '100%' }}>
          <Typography variant="body2">{params.row.cliente.nombre}</Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.cliente.rif_ci}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'condicion',
      headerName: 'Condición',
      width: 110,
      valueFormatter: (v: CondicionPago) => CONDICION[v],
    },
    colMonto('total_usd', 'Total', { width: 120 }),
    colMonto('pagado_usd', 'Pagado', { width: 120 }),
    colEstado('estado', 'Estado', ESTADO, { width: 120 }),
  ], [])

  return (
    <AppDataGrid
      tableId="facturas"
      label="Facturas"
      mode="client"
      rows={filas}
      columns={columns}
      initialSort={[{ field: 'numero', sort: 'desc' }]}
      getRowHref={(row) => `/facturas/${row.id}`}
      getSearchValues={(row) => [row.numero, row.cliente.nombre, row.cliente.rif_ci]}
      searchPlaceholder="Buscar por número, cliente o RIF..."
      filters={
        <ToggleButtonGroup
          size="small"
          value={condicion}
          exclusive
          onChange={(_, next: FiltroCondicion | null) => next && setCondicion(next)}
          aria-label="Filtrar por condición"
        >
          <ToggleButton value="todas">Todas</ToggleButton>
          <ToggleButton value="contado">Contado</ToggleButton>
          <ToggleButton value="credito">Crédito</ToggleButton>
        </ToggleButtonGroup>
      }
      emptyState={{
        title: 'Aún no hay facturas',
        description: 'Las facturas de contado y de crédito emitidas desde Pedidos / POS aparecerán aquí.',
      }}
      mobileCard={(row) => ({
        primary: `Factura N.º ${row.numero}`,
        secondary: `${row.cliente.nombre} · ${CONDICION[row.condicion]}`,
        status: <EstadoChip {...ESTADO[row.estado]} />,
        amount: formatUsd(Number(row.total_usd)),
      })}
    />
  )
}
