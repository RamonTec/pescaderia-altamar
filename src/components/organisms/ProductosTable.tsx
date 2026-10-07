'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import FilterListOffOutlinedIcon from '@mui/icons-material/FilterListOffOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import type { EmptyStateProps } from '@/components/molecules/EmptyState'
import {
  AppDataGrid,
  normalizarBusquedaSinSeparadores,
  writeUrlParams,
} from '@/components/organisms/AppDataGrid'
import { colAcciones } from '@/components/organisms/appDataGridColumns'
import type { Producto } from '@/types/domain'

/** Filtro del listado; vive en `?estado=` (sin parámetro = activos). */
export type FiltroProductos = 'activos' | 'todos'

const VACIO_FILTRO: Record<Exclude<FiltroProductos, 'todos'>, string> = {
  activos: 'No hay productos activos',
}

export function filtroProductosDesdeParam(value: string | null): FiltroProductos {
  return value === 'todos' ? 'todos' : 'activos'
}

export interface ProductosTableProps {
  productos: Producto[]
  esAdmin: boolean
  /** Producto con una acción en curso: su `⋮` queda deshabilitado con indicador. */
  estaPendiente: (id: string) => boolean
  onNuevo: () => void
  onEdit: (producto: Producto) => void
  onDesactivar: (producto: Producto) => void
  onActivar: (producto: Producto) => void
}

/**
 * Listado de productos sobre `AppDataGrid` (catálogo: modo cliente). Búsqueda
 * que ignora acentos, espacios, puntos y guiones ("cur001" encuentra
 * "CUR-001", y "merluza" también el procesado "de merluza"); filtro en chips
 * y en la URL; tarjetas en `xs`; sin ficha: la edición es el diálogo.
 */
export function ProductosTable({
  productos,
  esAdmin,
  estaPendiente,
  onNuevo,
  onEdit,
  onDesactivar,
  onActivar,
}: ProductosTableProps) {
  const searchParams = useSearchParams()
  const filtro = filtroProductosDesdeParam(searchParams.get('estado'))

  const nombrePorId = React.useMemo(
    () => new Map(productos.map((p) => [p.id, p.nombre])),
    [productos]
  )

  const filas = React.useMemo(
    () => (filtro === 'activos' ? productos.filter((p) => p.activo) : productos),
    [productos, filtro]
  )

  const cambiarFiltro = (next: FiltroProductos) => {
    if (next === filtro) return
    // Al cambiar el filtro, la página vuelve a 1.
    writeUrlParams({ estado: next === 'activos' ? null : next, pagina: null })
  }

  const conteo = React.useMemo(
    () => ({
      activos: productos.filter((p) => p.activo).length,
      todos: productos.length,
    }),
    [productos]
  )

  const getActions = React.useCallback(
    (p: Producto): RowAction[] =>
      esAdmin
        ? [
            { label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEdit(p) },
            p.activo
              ? {
                  label: 'Desactivar',
                  icon: <BlockOutlinedIcon fontSize="small" />,
                  destructive: true,
                  onClick: () => void onDesactivar(p),
                }
              : {
                  label: 'Activar',
                  icon: <CheckCircleOutlinedIcon fontSize="small" />,
                  onClick: () => onActivar(p),
                },
          ]
        : [],
    [esAdmin, onEdit, onDesactivar, onActivar]
  )

  const columns = React.useMemo<GridColDef<Producto>[]>(
    () => [
      {
        field: 'nombre',
        headerName: 'Producto',
        flex: 1.6,
        minWidth: 200,
        renderCell: ({ row }) => {
          if (row.tipo !== 'procesado') {
            return (
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                {row.nombre}
              </Typography>
            )
          }
          const origen = row.producto_origen_id ? nombrePorId.get(row.producto_origen_id) : null
          return (
            <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                {row.nombre}
              </Typography>
              <Typography variant="caption" noWrap color={origen ? 'text.secondary' : 'warning.main'}>
                {origen ? `de ${origen}` : 'Sin crudo asignado'}
              </Typography>
            </Box>
          )
        },
      },
      {
        field: 'codigo',
        headerName: 'Código',
        flex: 0.8,
        minWidth: 110,
        valueFormatter: (value: string | null) => value || '—',
      },
      {
        field: 'tipo',
        headerName: 'Tipo',
        flex: 0.7,
        minWidth: 110,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="soft"
            color={row.tipo === 'crudo' ? 'secondary' : 'primary'}
            label={row.tipo === 'crudo' ? 'Crudo' : 'Procesado'}
          />
        ),
      },
      {
        field: 'categoria',
        headerName: 'Categoría',
        flex: 0.9,
        minWidth: 120,
        valueFormatter: (value: string | null) => value || '—',
      },
      {
        field: 'controla_stock',
        headerName: 'Stock',
        sortable: false,
        flex: 0.8,
        minWidth: 110,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="soft"
            color={row.controla_stock ? 'success' : 'default'}
            label={row.controla_stock ? 'Controla stock' : 'Sin stock'}
          />
        ),
      },
      {
        field: 'estado',
        headerName: 'Estado',
        sortable: false,
        flex: 0.7,
        minWidth: 100,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="soft"
            color={row.activo ? 'success' : 'default'}
            label={row.activo ? 'Activo' : 'Inactivo'}
          />
        ),
      },
      ...(esAdmin
        ? [
            colAcciones<Producto>(getActions, {
              rowLabel: (row) => row.nombre,
              isPending: (row) => estaPendiente(row.id),
            }),
          ]
        : []),
    ],
    [esAdmin, getActions, estaPendiente, nombrePorId]
  )

  const emptyState: EmptyStateProps =
    productos.length === 0 || filtro === 'todos'
      ? {
          icon: <Inventory2OutlinedIcon fontSize="large" />,
          title: 'Aún no hay productos',
          description:
            'Con los productos registrados podrás comprar, procesar y vender. Los crudos entran por compras; los procesados nacen del procesamiento.',
          ...(esAdmin
            ? {
                action: (
                  <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={onNuevo}>
                    Nuevo producto
                  </Button>
                ),
              }
            : {}),
        }
      : {
          icon: <FilterListOffOutlinedIcon fontSize="large" />,
          title: VACIO_FILTRO[filtro],
          action: (
            <Button variant="outlined" onClick={() => cambiarFiltro('todos')}>
              Ver todos
            </Button>
          ),
        }

  return (
    <AppDataGrid<Producto>
      tableId="productos"
      label="Productos"
      mode="client"
      rows={filas}
      columns={columns}
      emptyState={emptyState}
      searchPlaceholder="Buscar por nombre, código o categoría"
      normalizeSearch={normalizarBusquedaSinSeparadores}
      getSearchValues={(row) => [
        row.nombre,
        row.codigo,
        row.categoria,
        row.producto_origen_id ? (nombrePorId.get(row.producto_origen_id) ?? null) : null,
      ]}
      initialSort={[{ field: 'nombre', sort: 'asc' }]}
      filters={
        <Box role="group" aria-label="Filtrar productos" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {(['activos', 'todos'] as const).map((value) => {
            const activo = value === filtro
            return (
              <Chip
                key={value}
                label={`${
                  value === 'activos' ? 'Activos' : 'Todos'
                } (${conteo[value]})`}
                variant={activo ? 'soft' : 'outlined'}
                color={activo ? 'primary' : 'default'}
                aria-pressed={activo}
                onClick={() => cambiarFiltro(value)}
              />
            )
          })}
        </Box>
      }
      mobileCard={(row) => ({
        primary: row.nombre,
        secondary: row.codigo || 'Sin código',
        // En la tarjeta solo lo que informa algo: tipo / Inactivo.
        status: (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              variant="soft"
              color={row.tipo === 'crudo' ? 'secondary' : 'primary'}
              label={row.tipo === 'crudo' ? 'Crudo' : 'Procesado'}
            />
            {row.activo ? null : <Chip size="small" variant="soft" color="default" label="Inactivo" />}
          </Box>
        ),
        ...(esAdmin
          ? {
              actions: (
                <RowActionsMenu
                  label={row.nombre}
                  actions={getActions(row)}
                  pending={estaPendiente(row.id)}
                  size="medium"
                />
              ),
            }
          : {}),
      })}
    />
  )
}