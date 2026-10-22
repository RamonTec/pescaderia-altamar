'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined'
import type { RowAction } from '@/components/molecules/RowActionsMenu'
import { StatusChips } from '@/components/molecules/StatusChips'
import { AppDataGrid, normalizarBusquedaSinSeparadores } from '@/components/organisms/AppDataGrid'
import { colAcciones } from '@/components/organisms/appDataGridColumns'
import { formatBs, formatFecha, formatUsd } from '@/lib/format'
import type { GastoRecurrente } from '@/types/domain'

export interface GastosRecurrentesTableProps {
  recurrentes: GastoRecurrente[]
  pendienteId?: string | null
  accionVacio?: React.ReactNode
  acciones?: React.ReactNode
  onEditar: (r: GastoRecurrente) => void
  onCambiarActivo: (r: GastoRecurrente) => void
}

function detalleFrecuencia(r: GastoRecurrente): string {
  if (r.frecuencia === 'quincenal') return 'Quincenal (15 y fin de mes)'
  return r.dia_mes ? `Mensual (día ${r.dia_mes})` : 'Mensual (fin de mes)'
}

function montoRecurrente(r: GastoRecurrente): string {
  if (r.monto === null || r.monto === undefined) {
    return 'Salario vigente'
  }
  return r.moneda === 'bs' ? formatBs(r.monto) : formatUsd(r.monto)
}

/**
 * Tabla de plantillas de gastos recurrentes (20-gastos, Fase C).
 */
export function GastosRecurrentesTable({
  recurrentes,
  pendienteId = null,
  accionVacio,
  acciones: accionesTabla,
  onEditar,
  onCambiarActivo,
}: GastosRecurrentesTableProps) {
  const acciones = React.useCallback(
    (r: GastoRecurrente): RowAction[] => {
      const lista: RowAction[] = []
      lista.push({ label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEditar(r) })
      lista.push(
        r.activo
          ? {
              label: 'Desactivar',
              icon: <VisibilityOffOutlinedIcon fontSize="small" />,
              onClick: () => onCambiarActivo(r),
              destructive: true,
            }
          : {
              label: 'Activar',
              icon: <VisibilityOutlinedIcon fontSize="small" />,
              onClick: () => onCambiarActivo(r),
            }
      )
      return lista
    },
    [onCambiarActivo, onEditar]
  )

  const columns = React.useMemo<GridColDef<GastoRecurrente>[]>(
    () => [
      {
        field: 'nombre',
        headerName: 'Plantilla',
        flex: 1.4,
        minWidth: 180,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {row.nombre}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.descripcion}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'categoria_id',
        headerName: 'Categoría',
        flex: 1,
        minWidth: 140,
        valueGetter: (_v, row) => row.categoria_nombre ?? '—',
      },
      {
        field: 'frecuencia',
        headerName: 'Frecuencia',
        flex: 1.1,
        minWidth: 160,
        valueGetter: (_v, row) => detalleFrecuencia(row),
      },
      {
        field: 'monto',
        headerName: 'Monto estimado',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        valueGetter: (_v, row) => montoRecurrente(row),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', textAlign: 'right' }}>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {montoRecurrente(row)}
            </Typography>
            {row.empleado_nombre ? (
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.empleado_nombre}
              </Typography>
            ) : null}
          </Box>
        ),
      },
      {
        field: 'fecha_inicio',
        headerName: 'Vigencia',
        width: 170,
        valueGetter: (_v, row) =>
          `${formatFecha(row.fecha_inicio)} – ${row.fecha_fin ? formatFecha(row.fecha_fin) : 'Indefinida'}`,
        renderCell: ({ row }) => (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            {formatFecha(row.fecha_inicio)} – {row.fecha_fin ? formatFecha(row.fecha_fin) : 'Indefinida'}
          </Typography>
        ),
      },
      {
        field: 'activo',
        headerName: 'Estado',
        width: 120,
        valueFormatter: (v: boolean) => (v ? 'Activo' : 'Inactivo'),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <StatusChips activo={row.activo} mostrarActivo />
          </Box>
        ),
      },
      colAcciones<GastoRecurrente>(acciones, {
        rowLabel: (row) => `plantilla ${row.nombre}`,
        isPending: (row) => row.id === pendienteId,
      }),
    ],
    [acciones, pendienteId]
  )

  return (
    <AppDataGrid<GastoRecurrente>
      tableId="gastos_recurrentes"
      label="Gastos recurrentes"
      rows={recurrentes}
      columns={columns}
      actions={accionesTabla}
      searchPlaceholder="Buscar por nombre, categoría o beneficiario"
      normalizeSearch={normalizarBusquedaSinSeparadores}
      getSearchValues={(r) => [
        r.nombre,
        r.descripcion,
        r.categoria_nombre ?? '',
        r.empleado_nombre ?? '',
        r.beneficiario ?? '',
      ]}
      initialSort={[{ field: 'nombre', sort: 'asc' }]}
      emptyState={{
        icon: <EventRepeatOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
        title: 'Sin plantillas de gastos recurrentes',
        description: 'Crea plantillas para gastos fijos periódicos como alquileres, nómina o servicios.',
        action: accionVacio,
      }}
    />
  )
}
