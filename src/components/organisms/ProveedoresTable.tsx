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
import { enmascararCuenta } from '@/lib/bancosVe'
import { formatUsd } from '@/lib/format'
import type { ProveedorResumen } from '@/lib/repositories/interfaces'

/** Filtro del listado; vive en `?estado=` (sin parámetro = activos). */
export type FiltroProveedores = 'activos' | 'bloqueados' | 'todos'

const FILTROS: { value: FiltroProveedores; label: string }[] = [
  { value: 'activos', label: 'Activos' },
  { value: 'bloqueados', label: 'Bloqueados' },
  { value: 'todos', label: 'Todos' },
]

const VACIO_FILTRO: Record<Exclude<FiltroProveedores, 'todos'>, string> = {
  activos: 'No hay proveedores activos',
  bloqueados: 'No hay proveedores bloqueados',
}

export function filtroDesdeParam(value: string | null): FiltroProveedores {
  return value === 'bloqueados' || value === 'todos' ? value : 'activos'
}

export interface ProveedoresTableProps {
  proveedores: ProveedorResumen[]
  /** Saldo pendiente real por id (04-inventario). */
  saldos: Record<string, number>
  esAdmin: boolean
  /** Proveedor con una acción en curso: su `⋮` queda deshabilitado con indicador. */
  estaPendiente: (id: string) => boolean
  onNuevo: () => void
  onEdit: (proveedor: ProveedorResumen) => void
  onBloquear: (proveedor: ProveedorResumen) => void
  onDesbloquear: (proveedor: ProveedorResumen) => void
  onDesactivar: (proveedor: ProveedorResumen) => void
  onActivar: (proveedor: ProveedorResumen) => void
}

function metodoPreferidoLabel(p: ProveedorResumen): string | null {
  const preferido = p.metodos_pago_proveedor.find((m) => m.preferido)
  if (!preferido) return null
  if (preferido.tipo === 'transferencia' && preferido.numero_cuenta) {
    return enmascararCuenta(preferido.numero_cuenta)
  }
  if (preferido.tipo === 'pago_movil') return preferido.telefono ?? 'Pago Móvil'
  if (preferido.tipo === 'zelle') return preferido.email ?? 'Zelle'
  return null
}

const searchValues = (p: ProveedorResumen) => [p.nombre, p.rif_ci, p.contacto_nombre]

/**
 * Listado de proveedores sobre `AppDataGrid` (catálogo: modo cliente).
 * Búsqueda que ignora acentos, mayúsculas, espacios, puntos y guiones
 * ("v12345" encuentra "V-12.345"); filtro en chips y en la URL; tarjetas en
 * `xs` con el saldo visible; fila abre la ficha (clic o Enter).
 */
export function ProveedoresTable({
  proveedores,
  saldos,
  esAdmin,
  estaPendiente,
  onNuevo,
  onEdit,
  onBloquear,
  onDesbloquear,
  onDesactivar,
  onActivar,
}: ProveedoresTableProps) {
  const searchParams = useSearchParams()
  const filtro = filtroDesdeParam(searchParams.get('estado'))

  const conteo = React.useMemo(
    () => ({
      activos: proveedores.filter((p) => p.activo).length,
      bloqueados: proveedores.filter((p) => p.bloqueado).length,
      todos: proveedores.length,
    }),
    [proveedores]
  )

  const filas = React.useMemo(
    () =>
      proveedores.filter((p) => {
        if (filtro === 'activos') return p.activo
        if (filtro === 'bloqueados') return p.bloqueado
        return true
      }),
    [proveedores, filtro]
  )

  const cambiarFiltro = (next: FiltroProveedores) => {
    if (next === filtro) return
    // Al cambiar el filtro, la página vuelve a 1.
    writeUrlParams({ estado: next === 'activos' ? null : next, pagina: null })
  }

  const getActions = React.useCallback(
    (p: ProveedorResumen): RowAction[] => {
      const lista: RowAction[] = [
        { label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEdit(p) },
      ]
      if (esAdmin) {
        lista.push(
          p.bloqueado
            ? {
                label: 'Desbloquear',
                icon: <LockOpenOutlinedIcon fontSize="small" />,
                onClick: () => onDesbloquear(p),
              }
            : {
                label: 'Bloquear',
                icon: <LockOutlinedIcon fontSize="small" />,
                onClick: () => onBloquear(p),
              }
        )
      }
      lista.push(
        p.activo
          ? {
              label: 'Desactivar',
              icon: <BlockOutlinedIcon fontSize="small" />,
              destructive: true,
              onClick: () => onDesactivar(p),
            }
          : {
              label: 'Activar',
              icon: <CheckCircleOutlinedIcon fontSize="small" />,
              onClick: () => onActivar(p),
            }
      )
      return lista
    },
    [esAdmin, onEdit, onBloquear, onDesbloquear, onDesactivar, onActivar]
  )

  const columns = React.useMemo<GridColDef<ProveedorResumen>[]>(
    () => [
      {
        field: 'nombre',
        headerName: 'Proveedor',
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
      {
        field: 'contacto_nombre',
        headerName: 'Contacto',
        flex: 1,
        minWidth: 130,
        valueFormatter: (value: string | null) => value || '—',
      },
      {
        field: 'pago',
        headerName: 'Método de pago preferido',
        flex: 1.2,
        minWidth: 170,
        valueGetter: (_v, row) => metodoPreferidoLabel(row) ?? '—',
      },
      colMonto<ProveedorResumen>('saldo_pendiente', 'Saldo pendiente', {
        flex: 1,
        minWidth: 140,
        valueGetter: (_v, row) => saldos[row.id] ?? 0,
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
      colAcciones<ProveedorResumen>(getActions, {
        rowLabel: (row) => row.nombre,
        isPending: (row) => estaPendiente(row.id),
      }),
    ],
    [getActions, estaPendiente, saldos]
  )

  const emptyState: EmptyStateProps =
    proveedores.length === 0 || filtro === 'todos'
      ? {
          icon: <PeopleOutlinedIcon fontSize="large" />,
          title: 'Aún no hay proveedores',
          description:
            'Con los proveedores registrados podrás recibir mercancía a crédito y ver cuánto se le debe a cada uno.',
          action: (
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={onNuevo}>
              Nuevo proveedor
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
    <AppDataGrid<ProveedorResumen>
      tableId="proveedores"
      label="Proveedores"
      mode="client"
      rows={filas}
      columns={columns}
      emptyState={emptyState}
      searchPlaceholder="Buscar por nombre, RIF o contacto"
      normalizeSearch={normalizarBusquedaSinSeparadores}
      getSearchValues={searchValues}
      getRowHref={(row) => `/proveedores/${row.id}`}
      initialSort={[{ field: 'nombre', sort: 'asc' }]}
      // Secundarias: visibles en md+, ocultas en xs/sm cuando no hay tarjetas.
      hideOnMobile={['telefono', 'contacto_nombre', 'pago', 'saldo_pendiente']}
      filters={
        <Box role="group" aria-label="Filtrar proveedores" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
        // En la tarjeta solo lo que informa algo (Bloqueado / Inactivo /
        // Doc. incompleta); "Activo" no se repite.
        status: (
          <StatusChips bloqueado={row.bloqueado} motivoBloqueo={row.motivo_bloqueo} activo={row.activo} />
        ),
        // El saldo es el motivo de consulta más común: visible en la tarjeta.
        amount: formatUsd(saldos[row.id] ?? 0),
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