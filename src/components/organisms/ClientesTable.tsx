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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import FilterListOffOutlinedIcon from '@mui/icons-material/FilterListOffOutlined'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { StatusChips } from '@/components/molecules/StatusChips'
import type { EmptyStateProps } from '@/components/molecules/EmptyState'
import {
  AppDataGrid,
  normalizarBusquedaSinSeparadores,
  writeUrlParams,
} from '@/components/organisms/AppDataGrid'
import { colAcciones, colMonto } from '@/components/organisms/appDataGridColumns'
import type { Cliente } from '@/types/domain'

/** Filtro del listado; vive en `?estado=` (sin parámetro = activos). */
export type FiltroClientes = 'activos' | 'bloqueados' | 'todos'

const FILTROS: { value: FiltroClientes; label: string }[] = [
  { value: 'activos', label: 'Activos' },
  { value: 'bloqueados', label: 'Bloqueados' },
  { value: 'todos', label: 'Todos' },
]

const VACIO_FILTRO: Record<Exclude<FiltroClientes, 'todos'>, string> = {
  activos: 'No hay clientes activos',
  bloqueados: 'No hay clientes bloqueados',
}

export function filtroDesdeParam(value: string | null): FiltroClientes {
  return value === 'bloqueados' || value === 'todos' ? value : 'activos'
}

export interface ClientesTableProps {
  clientes: Cliente[]
  esAdmin: boolean
  /** Cliente con una acción en curso: su `⋮` queda deshabilitado con indicador. */
  estaPendiente: (id: string) => boolean
  onNuevo: () => void
  onEdit: (cliente: Cliente) => void
  onBloquear: (cliente: Cliente) => void
  onDesbloquear: (cliente: Cliente) => void
  onDesactivar: (cliente: Cliente) => void
  onActivar: (cliente: Cliente) => void
}

const searchValues = (c: Cliente) => [c.nombre, c.rif_ci, c.telefono]

/**
 * Listado de clientes sobre `AppDataGrid` (catálogo: modo cliente). Búsqueda
 * que ignora acentos, mayúsculas, espacios, puntos y guiones; filtro en chips
 * y en la URL; tarjetas en `xs`; fila abre la ficha (clic o Enter).
 */
export function ClientesTable({
  clientes,
  esAdmin,
  estaPendiente,
  onNuevo,
  onEdit,
  onBloquear,
  onDesbloquear,
  onDesactivar,
  onActivar,
}: ClientesTableProps) {
  const searchParams = useSearchParams()
  const filtro = filtroDesdeParam(searchParams.get('estado'))

  const conteo = React.useMemo(
    () => ({
      activos: clientes.filter((c) => c.activo).length,
      bloqueados: clientes.filter((c) => c.bloqueado).length,
      todos: clientes.length,
    }),
    [clientes]
  )

  const filas = React.useMemo(
    () =>
      clientes.filter((c) => {
        if (filtro === 'activos') return c.activo
        if (filtro === 'bloqueados') return c.bloqueado
        return true
      }),
    [clientes, filtro]
  )

  const cambiarFiltro = (next: FiltroClientes) => {
    if (next === filtro) return
    // Al cambiar el filtro, la página vuelve a 1.
    writeUrlParams({ estado: next === 'activos' ? null : next, pagina: null })
  }

  const getActions = React.useCallback(
    (c: Cliente): RowAction[] => {
      const lista: RowAction[] = [
        { label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEdit(c) },
      ]
      if (esAdmin) {
        lista.push(
          c.bloqueado
            ? {
                label: 'Desbloquear',
                icon: <LockOpenOutlinedIcon fontSize="small" />,
                onClick: () => onDesbloquear(c),
              }
            : {
                label: 'Bloquear',
                icon: <LockOutlinedIcon fontSize="small" />,
                onClick: () => onBloquear(c),
              }
        )
      }
      lista.push(
        c.activo
          ? {
              label: 'Desactivar',
              icon: <BlockOutlinedIcon fontSize="small" />,
              destructive: true,
              onClick: () => onDesactivar(c),
            }
          : {
              label: 'Activar',
              icon: <CheckCircleOutlinedIcon fontSize="small" />,
              onClick: () => onActivar(c),
            }
      )
      return lista
    },
    [esAdmin, onEdit, onBloquear, onDesbloquear, onDesactivar, onActivar]
  )

  const columns = React.useMemo<GridColDef<Cliente>[]>(
    () => [
      {
        field: 'nombre',
        headerName: 'Cliente',
        flex: 1.6,
        minWidth: 200,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {row.nombre}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.rif_ci ?? 'Sin RIF / cédula'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'telefono',
        headerName: 'Teléfono',
        flex: 1,
        minWidth: 130,
        valueFormatter: (value: string | null) => value || '—',
      },
      colMonto<Cliente>('limite_credito_usd', 'Límite de crédito', {
        flex: 0.9,
        minWidth: 140,
        renderCell: ({ value, formattedValue }) =>
          value ? (
            formattedValue
          ) : (
            <Typography variant="body2" component="span" color="text.secondary">
              Sin crédito
            </Typography>
          ),
      }),
      {
        field: 'estado',
        headerName: 'Estado',
        sortable: false,
        flex: 1,
        minWidth: 150,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <StatusChips
              bloqueado={row.bloqueado}
              motivoBloqueo={row.motivo_bloqueo}
              activo={row.activo}
              mostrarActivo
            />
          </Box>
        ),
      },
      colAcciones<Cliente>(getActions, {
        rowLabel: (row) => row.nombre,
        isPending: (row) => estaPendiente(row.id),
      }),
    ],
    [getActions, estaPendiente]
  )

  const emptyState: EmptyStateProps =
    clientes.length === 0 || filtro === 'todos'
      ? {
          icon: <PeopleOutlinedIcon fontSize="large" />,
          title: 'Aún no hay clientes',
          description:
            'Con los clientes registrados podrás venderles a crédito, agendar pedidos y ver su historial.',
          action: (
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={onNuevo}>
              Nuevo cliente
            </Button>
          ),
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
    <AppDataGrid<Cliente>
      tableId="clientes"
      label="Clientes"
      mode="client"
      rows={filas}
      columns={columns}
      emptyState={emptyState}
      searchPlaceholder="Buscar por nombre, RIF o teléfono"
      normalizeSearch={normalizarBusquedaSinSeparadores}
      getSearchValues={searchValues}
      getRowHref={(row) => `/clientes/${row.id}`}
      initialSort={[{ field: 'nombre', sort: 'asc' }]}
      filters={
        <Box role="group" aria-label="Filtrar clientes" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {FILTROS.map((f) => {
            const activo = f.value === filtro
            return (
              <Chip
                key={f.value}
                label={`${f.label} (${conteo[f.value]})`}
                variant={activo ? 'soft' : 'outlined'}
                color={activo ? 'primary' : 'default'}
                aria-pressed={activo}
                onClick={() => cambiarFiltro(f.value)}
              />
            )
          })}
        </Box>
      }
      mobileCard={(row) => ({
        primary: row.nombre,
        secondary: row.rif_ci ?? 'Sin RIF / cédula',
        // En la tarjeta solo lo que informa algo: Bloqueado / Inactivo.
        status: (
          <StatusChips bloqueado={row.bloqueado} motivoBloqueo={row.motivo_bloqueo} activo={row.activo} />
        ),
        actions: (
          <RowActionsMenu
            label={row.nombre}
            actions={getActions(row)}
            pending={estaPendiente(row.id)}
            size="medium"
          />
        ),
      })}
    />
  )
}
