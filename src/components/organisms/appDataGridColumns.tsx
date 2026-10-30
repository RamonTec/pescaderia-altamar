'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ChipProps } from '@mui/material/Chip'
import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid'
import { EstadoChip } from '@/components/atoms/EstadoChip'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import {
  conGuion,
  FALTANTE,
  formatBs,
  formatFecha,
  formatKg,
  formatTasa,
  formatUsd,
} from '@/lib/format'

/**
 * Helpers de columnas para `AppDataGrid` (spec § Tablas y paginación): montos,
 * kg y tasas a la derecha con cifras tabulares (las aplica el theme), fechas
 * con `formatFecha`, estados como chips de 22 px y la columna de acciones al
 * final con un solo menú `⋮`. Se combinan con `{ ...colMonto(...), flex: 1 }`.
 * Un dato faltante (`null`, `''`) se muestra como "—".
 */


type Base<R extends GridValidRowModel> = Partial<GridColDef<R>>

/** `field` de la columna de acciones (`colAcciones`). */
export const ACTIONS_FIELD = '__acciones'

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
    valueFormatter: (value: number | string | null | undefined) =>
      conGuion(value, (v) => format(Number(v))),
    ...extra,
  }
}

/**
 * Columna principal: el nombre en `body2` 500 y, debajo en la misma celda, el
 * identificador secundario (código, RIF) en `caption`. Flexible por defecto.
 * La búsqueda rápida usa el valor de `field`; si el secundario también debe
 * encontrarse, la tabla pasa `getSearchValues`.
 */
export function colPrincipal<R extends GridValidRowModel>({
  field,
  headerName,
  secundario,
  ...extra
}: {
  field: string
  headerName: string
  secundario?: (row: R) => string | null | undefined
} & Base<R>): GridColDef<R> {
  return {
    field,
    headerName,
    flex: 1,
    minWidth: 200,
    valueFormatter: (value: string | null | undefined) => conGuion(value),
    renderCell: ({ row, formattedValue }) => {
      const sub = secundario?.(row)
      return (
        <Box sx={{ minWidth: 0, display: 'grid', lineHeight: 1.3 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {formattedValue as React.ReactNode}
          </Typography>
          {sub ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              {sub}
            </Typography>
          ) : null}
        </Box>
      )
    },
    ...extra,
  }
}

/**
 * Monto en USD (por defecto) o Bs. `destacarPositivo` pone en 600 los valores
 * mayores que 0 (saldos).
 */
export function colMonto<R extends GridValidRowModel>(
  field: string,
  headerName: string,
  options: { moneda?: 'usd' | 'bs'; destacarPositivo?: boolean } & Base<R> = {}
): GridColDef<R> {
  const { moneda = 'usd', destacarPositivo = false, ...extra } = options
  return numberCol<R>(field, headerName, moneda === 'bs' ? formatBs : formatUsd, {
    ...(destacarPositivo
      ? {
          renderCell: ({ value, formattedValue }) => (
            <Box component="span" sx={{ fontWeight: Number(value) > 0 ? 600 : undefined }}>
              {formattedValue as React.ReactNode}
            </Box>
          ),
        }
      : {}),
    ...extra,
  })
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
      conGuion(value, (v) => estados[v]?.label ?? v),
    renderCell: ({ value }) => {
      if (!value) return FALTANTE
      const def = estados[String(value)]
      return <EstadoChip label={def?.label ?? String(value)} color={def?.color ?? 'default'} />
    },
    ...extra,
  }
}

export { EstadoChip } from '@/components/atoms/EstadoChip'

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
    field: ACTIONS_FIELD,
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
