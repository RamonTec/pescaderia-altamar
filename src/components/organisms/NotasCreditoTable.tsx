'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { type GridColDef } from '@mui/x-data-grid'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { colAcciones, colEstado, colFecha, colMonto, type EstadoDef } from '@/components/organisms/appDataGridColumns'
import { formatUsd } from '@/lib/format'
import type { NotaCreditoResumen } from '@/lib/repositories/interfaces'
import { EstadoChip } from '@/components/organisms/appDataGridColumns'

const ESTADO: Record<'emitida' | 'anulada', EstadoDef> = {
  emitida: { label: 'Emitida', color: 'success' },
  anulada: { label: 'Anulada', color: 'default' },
}

export interface NotasCreditoTableProps {
  notas: NotaCreditoResumen[]
  totalNotas?: number
  esAdmin: boolean
  onAnular: (nota: NotaCreditoResumen) => void
}

function EstadoFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('estado') || 'todos'

  const handleChange = (_: unknown, next: string | null) => {
    if (!next) return
    const p = new URLSearchParams(searchParams)
    if (next === 'todos') p.delete('estado')
    else p.set('estado', next)
    p.delete('page') // Al filtrar, volver a pág 1
    router.replace(`?${p.toString()}`)
  }

  return (
    <ToggleButtonGroup
      size="small"
      value={current}
      exclusive
      onChange={handleChange}
      aria-label="Filtrar por estado"
    >
      <ToggleButton value="todos">Todas</ToggleButton>
      <ToggleButton value="emitida">Emitidas</ToggleButton>
      <ToggleButton value="anulada">Anuladas</ToggleButton>
    </ToggleButtonGroup>
  )
}

export function NotasCreditoTable({ notas, totalNotas, esAdmin, onAnular }: NotasCreditoTableProps) {
  const columns: GridColDef<NotaCreditoResumen>[] = React.useMemo(() => [
    {
      field: 'numero',
      headerName: 'N.º',
      width: 90,
    },
    colFecha('fecha', 'Fecha', { width: 120 }),
    {
      field: 'factura',
      headerName: 'Factura',
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => `${row.factura.numero} · ${row.factura.cliente.nombre}`,
      renderCell: (params) => (
        <Box sx={{ display: 'grid', alignContent: 'center', height: '100%' }}>
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
    colMonto('total_usd', 'Total', { width: 120 }),
    colEstado('estado', 'Estado', ESTADO, { width: 120 }),
    ...(esAdmin
      ? [
          colAcciones<NotaCreditoResumen>(
            (row) => [
              {
                label: 'Anular',
                onClick: () => onAnular(row),
                show: row.estado === 'emitida',
                danger: true,
              },
            ],
            { rowLabel: (row) => `Nota N.º ${row.numero}` }
          ),
        ]
      : []),
  ], [esAdmin, onAnular])

  return (
    <AppDataGrid
      tableId="notas-credito"
      label="Notas de crédito"
      mode="server"
      rows={notas}
      rowCount={totalNotas}
      columns={columns}
      filters={<EstadoFilter />}
      searchPlaceholder="Buscar por número o cliente..."
      emptyState={{
        title: 'Aún no hay notas de crédito',
        description: 'Las devoluciones y correcciones sobre facturas emitidas aparecerán aquí.',
      }}
      mobileCard={(row) => ({
        primary: `Nota N.º ${row.numero}`,
        secondary: `Factura ${row.factura.numero} · ${row.factura.cliente.nombre}`,
        status: <EstadoChip {...ESTADO[row.estado as 'emitida' | 'anulada']} />,
        amount: formatUsd(Number(row.total_usd)),
        actions: esAdmin && row.estado === 'emitida' ? (
          <Button size="small" color="error" onClick={() => onAnular(row)}>Anular</Button>
        ) : undefined,
      })}
    />
  )
}
