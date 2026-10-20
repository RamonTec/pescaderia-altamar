'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { type GridColDef } from '@mui/x-data-grid'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { LoteChip } from '@/components/molecules/LoteChip'
import type { RowAction } from '@/components/molecules/RowActionsMenu'
import { colAcciones, colEstado, colFecha, colMonto, type EstadoDef } from '@/components/organisms/appDataGridColumns'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { formatFecha, formatUsd } from '@/lib/format'
import type { CompraResumen } from '@/lib/repositories/interfaces'
import type { EstadoDoc } from '@/types/domain'

/** Para el operador los importes llegan en `null` (costos y balances son de admin). */
export type CompraFila = Omit<CompraResumen, 'subtotal_usd' | 'pagado_usd'> & {
  subtotal_usd: number | null
  pagado_usd: number | null
  /** Códigos de los lotes que creó la compra (07-lotes). */
  lotes?: string[]
}

export const ESTADOS_COMPRA: Record<EstadoDoc, EstadoDef> = {
  abierta: { label: 'Por pagar', color: 'warning' },
  pagada: { label: 'Pagada', color: 'success' },
  anulada: { label: 'Anulada', color: 'default' },
}

export interface ComprasTableProps {
  compras: CompraFila[]
  total: number
  esAdmin: boolean
  onPagar: (compra: CompraFila) => void
  onNueva: () => void
  /** Acciones extra del `⋮` (06-contratos: generar / ver contrato), solo admin. */
  accionesExtra?: (row: CompraFila) => RowAction[]
  /** 19: abre la ficha `/compras/[id]` (solo admin). */
  onAbrir?: (row: CompraFila, editar: boolean) => void
}

/** Ruta de la ficha de una compra (19); `editar` abre el diálogo al cargar. */
export const hrefCompra = (id: string, editar = false) => `/compras/${id}${editar ? '?editar=1' : ''}`

/** Acciones del `⋮` hacia la ficha (19, admin): "Ver detalle" y "Editar compra". */
export function accionesFichaCompra(
  row: { estado: EstadoDoc },
  abrir: (editar: boolean) => void
): RowAction[] {
  return [
    { label: 'Ver detalle', icon: <ReceiptLongOutlinedIcon fontSize="small" />, onClick: () => abrir(false) },
    {
      label: 'Editar compra',
      icon: <EditOutlinedIcon fontSize="small" />,
      disabled: row.estado === 'anulada',
      onClick: () => abrir(true),
    },
  ]
}

export function ComprasTable({ compras, total, esAdmin, onPagar, onNueva, accionesExtra, onAbrir }: ComprasTableProps) {
  const columns: GridColDef<CompraFila>[] = React.useMemo(() => [
    colFecha('fecha', 'Fecha', { width: 120 }),
     {
      field: 'proveedor',
      headerName: 'Proveedor',
      flex: 1.6,
      minWidth: 200,
      valueGetter: (_v, row) => row.proveedor?.nombre ?? '—',
      renderCell: (params) => (
        <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
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
      field: 'lotes',
      headerName: 'Lotes',
      flex: 1.2,
      minWidth: 170,
      sortable: false,
      valueGetter: (_v, row) => (row.lotes ?? []).join(' '),
      renderCell: (params) => {
        const codigos = params.row.lotes ?? []
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', height: '100%' }}>
            {codigos.slice(0, 2).map((c) => (
              <LoteChip key={c} codigo={c} />
            ))}
            {codigos.length > 2 ? (
              <Typography variant="caption" color="text.secondary">
                +{codigos.length - 2}
              </Typography>
            ) : null}
          </Box>
        )
      },
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
      valueFormatter: (v: string) => v?.toUpperCase() ?? '—',
    },
    colEstado('estado', 'Estado', ESTADOS_COMPRA, { width: 120 }),
    ...(esAdmin
      ? ([
          colMonto('subtotal_usd', 'Total', { width: 130 }),
          colMonto('saldo', 'Saldo', {
            width: 150,
            valueGetter: (_v, row) => Number(row.subtotal_usd) - Number(row.pagado_usd),
            // 19: lo pagado por encima del total es un saldo a favor del negocio.
            renderCell: (params) => {
              const saldo = Math.round((Number(params.row.subtotal_usd) - Number(params.row.pagado_usd)) * 1e6) / 1e6
              return saldo < 0 ? (
                <Typography variant="body2" color="success.main" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatUsd(-saldo)} a favor
                </Typography>
              ) : (
                formatUsd(saldo)
              )
            },
          }),
          colAcciones((row) => {
            const actions: RowAction[] = []
            if (row.estado === 'abierta') {
              actions.push({
                label: 'Registrar pago',
                onClick: () => onPagar(row),
              })
            }
            if (onAbrir) actions.push(...accionesFichaCompra(row, (editar) => onAbrir(row, editar)))
            if (accionesExtra) actions.push(...accionesExtra(row))
            return actions
          }, { rowLabel: (row) => `compra a ${row.proveedor?.nombre}` }),
        ] satisfies GridColDef<CompraFila>[])
      : []),
  ], [esAdmin, onPagar, accionesExtra, onAbrir])

  return (
    <AppDataGrid<CompraFila>
      tableId="compras"
      label="Compras"
      mode="server"
      rows={compras}
      rowCount={total}
      columns={columns}
      getRowHref={esAdmin && onAbrir ? (row) => hrefCompra(row.id) : undefined}
      emptyState={{
        title: 'Registra tu primera compra',
        description: 'Cada compra suma el producto pesado al inventario con su costo por kg.',
        action: <Button variant="contained" onClick={onNueva}>Nueva compra</Button>,
      }}
      mobileCard={(row) => {
        return {
          primary: row.proveedor?.nombre ?? '—',
          secondary: `Compra del ${formatFecha(row.fecha)}`,
          amount: esAdmin ? Number(row.subtotal_usd) : null,
          status: row.estado,
          statusColors: ESTADOS_COMPRA,
        }
      }}
    />
  )
}
