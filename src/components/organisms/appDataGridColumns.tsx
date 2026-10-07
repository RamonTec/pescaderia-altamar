'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Chip, { type ChipProps } from '@mui/material/Chip'
import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { formatBs, formatFecha, formatKg, formatTasa, formatUsd } from '@/lib/format'

/**
 * Helpers de columnas para `AppDataGrid` (spec § Tablas y paginación): montos,
 * kg y tasas a la derecha con cifras tabulares (las aplica el theme), fechas
 * con `formatFecha`, estados como chips de 22 px y la columna de acciones al
 * final con un solo menú `⋮`. Se combinan con `{ ...colMonto(...), flex: 1 }`.
 */

type Base<R extends GridValidRowModel> = Partial<GridColDef<R>>

const NUMERIC: Partial<GridColDef> = {
  type: 'number',
  align: 'right',
  headerAlign: 'right',
}

function numberCol<R extends GridValidRowModel>(
  field: string,
  headerName: string,
  format: (n: number) => string,
  extra?: Base<R>
): GridColDef<R> {
  return {
    ...(NUMERIC as Partial<GridColDef<R>>),
    field,
    headerName,
    minWidth: 120,
    valueFormatter: (value: number | null | undefined) =>
      value === null || value === undefined ? '—' : format(Number(value)),
    ...extra,
  }
}

/** Monto en USD (por defecto) o Bs. */
export function colMonto<R extends GridValidRowModel>(
  field: string,
  headerName: string,
  options: { moneda?: 'usd' | 'bs' } & Base<R> = {}
): GridColDef<R> {
  const { moneda = 'usd', ...extra } = options
  return numberCol<R>(field, headerName, moneda === 'bs' ? formatBs : formatUsd, extra)
}

/** Peso en kg con 3 decimales. */
export function colKg<R extends GridValidRowModel>(
  field: string,
  headerName: string,
  extra?: Base<R>
): GridColDef<R> {
  return numberCol<R>(field, headerName, formatKg, extra)
}

/** Tasa de cambio (Bs por USD). */
export function colTasa<R extends GridValidRowModel>(
  field: string,
  headerName: string,
  extra?: Base<R>
): GridColDef<R> {
  return numberCol<R>(field, headerName, formatTasa, extra)
}

/** Fecha ISO (`YYYY-MM-DD…`) → `06 oct 2026`. Ordena por el valor ISO. */
export function colFecha<R extends GridValidRowModel>(
  field: string,
  headerName: string,
  extra?: Base<R>
): GridColDef<R> {
  return {
    field,
    headerName,
    minWidth: 120,
    valueFormatter: (value: string | null | undefined) => formatFecha(value),
    ...extra,
  }
}

export interface EstadoDef {
  label: string
  color: NonNullable<ChipProps['color']>
}

/** Estado como chip `soft` de 22 px. `estados` mapea el valor crudo a etiqueta y color. */
export function colEstado<R extends GridValidRowModel>(
  field: string,
  headerName: string,
  estados: Record<string, EstadoDef>,
  extra?: Base<R>
): GridColDef<R> {
  return {
    field,
    headerName,
    minWidth: 120,
    valueFormatter: (value: string | null | undefined) =>
      value ? (estados[value]?.label ?? value) : '',
    renderCell: ({ value }) => {
      if (!value) return null
      const def = estados[String(value)]
      return <EstadoChip label={def?.label ?? String(value)} color={def?.color ?? 'default'} />
    },
    ...extra,
  }
}

export function EstadoChip({ label, color }: { label: string; color: EstadoDef['color'] }) {
  return <Chip size="small" variant="soft" color={color} label={label} />
}

/**
 * Columna de acciones: siempre la última, un solo menú `⋮` por fila.
 * `isPending(row)` deshabilita el menú de esa fila mientras procesa.
 */
export function colAcciones<R extends GridValidRowModel>(
  getActions: (row: R) => RowAction[],
  options: { rowLabel: (row: R) => string; isPending?: (row: R) => boolean } & Base<R>
): GridColDef<R> {
  const { rowLabel, isPending, ...extra } = options
  return {
    field: '__acciones',
    headerName: '',
    width: 64,
    align: 'center',
    headerAlign: 'center',
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    disableExport: true,
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <RowActionsMenu
          label={rowLabel(row)}
          actions={getActions(row)}
          pending={isPending?.(row) ?? false}
          size="small"
        />
      </Box>
    ),
    ...extra,
  }
}
