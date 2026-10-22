'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { StatusChips } from '@/components/molecules/StatusChips'
import { AppDataGrid, normalizarBusquedaSinSeparadores } from '@/components/organisms/AppDataGrid'
import { colAcciones } from '@/components/organisms/appDataGridColumns'
import { formatBs, formatUsd } from '@/lib/format'
import type { Empleado } from '@/types/domain'

export interface EmpleadosTableProps {
  empleados: Empleado[]
  /** USD pagado (confirmado) a cada empleado en el mes en curso. */
  pagadoMes: Record<string, number>
  /** Empleado con una acción en curso (menú deshabilitado). */
  pendienteId?: string | null
  /** Botón del estado vacío ("Nuevo empleado"). */
  accionVacio?: React.ReactNode
  /** Botones sobre la tabla. */
  acciones?: React.ReactNode
  onEditar: (e: Empleado) => void
  onRegistrarPago: (e: Empleado) => void
  onCambiarActivo: (e: Empleado) => void
}

export function hrefEmpleado(id: string): string {
  return `/gastos/empleados/${id}`
}

export function salarioEnMoneda(e: Pick<Empleado, 'moneda' | 'salario_base'>): string {
  return e.moneda === 'bs' ? formatBs(e.salario_base) : formatUsd(e.salario_base)
}

/**
 * Empleados (20-gastos, Fase B), `AppDataGrid` en modo cliente: nombre,
 * cédula, cargo, salario base mensual en su moneda, pagado en el mes en
 * curso (USD, solo confirmados) y estado. La fila abre la ficha; `⋮`:
 * Registrar pago (activos), Editar y Desactivar / Activar.
 */
export function EmpleadosTable({
  empleados,
  pagadoMes,
  pendienteId = null,
  accionVacio,
  acciones: accionesTabla,
  onEditar,
  onRegistrarPago,
  onCambiarActivo,
}: EmpleadosTableProps) {
  const acciones = React.useCallback(
    (e: Empleado): RowAction[] => {
      const lista: RowAction[] = []
      if (e.activo) {
        lista.push({
          label: 'Registrar pago',
          icon: <PaymentsOutlinedIcon fontSize="small" />,
          onClick: () => onRegistrarPago(e),
        })
      }
      lista.push({ label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEditar(e) })
      lista.push(
        e.activo
          ? {
              label: 'Desactivar',
              icon: <VisibilityOffOutlinedIcon fontSize="small" />,
              onClick: () => onCambiarActivo(e),
              destructive: true,
            }
          : {
              label: 'Activar',
              icon: <VisibilityOutlinedIcon fontSize="small" />,
              onClick: () => onCambiarActivo(e),
            }
      )
      return lista
    },
    [onCambiarActivo, onEditar, onRegistrarPago]
  )

  const columns = React.useMemo<GridColDef<Empleado>[]>(
    () => [
      { field: 'nombre', headerName: 'Nombre', flex: 1.4, minWidth: 180 },
      { field: 'cedula', headerName: 'Cédula', width: 140 },
      {
        field: 'cargo',
        headerName: 'Cargo',
        flex: 1,
        minWidth: 140,
        valueFormatter: (v: string | null) => v ?? '—',
      },
      {
        field: 'salario_base',
        headerName: 'Salario mensual',
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        width: 160,
        valueFormatter: (_v, row) => salarioEnMoneda(row),
      },
      {
        field: 'pagado_mes',
        headerName: 'Pagado este mes',
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        width: 160,
        valueGetter: (_v, row) => pagadoMes[row.id] ?? 0,
        valueFormatter: (v: number) => formatUsd(v),
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
      colAcciones<Empleado>(acciones, {
        rowLabel: (row) => `empleado ${row.nombre}`,
        isPending: (row) => row.id === pendienteId,
      }),
    ],
    [acciones, pagadoMes, pendienteId]
  )

  return (
    <AppDataGrid<Empleado>
      tableId="empleados"
      label="Empleados"
      rows={empleados}
      columns={columns}
      searchPlaceholder="Buscar por nombre, cédula o cargo"
      normalizeSearch={normalizarBusquedaSinSeparadores}
      getSearchValues={(e) => [e.nombre, e.cedula, e.cargo]}
      actions={accionesTabla}
      initialSort={[{ field: 'nombre', sort: 'asc' }]}
      getRowHref={(e) => hrefEmpleado(e.id)}
      hideOnMobile={['cargo', 'cedula']}
      emptyState={{
        icon: <BadgeOutlinedIcon />,
        title: 'Aún no hay empleados',
        description: 'Registra a tus empleados para llevar sus pagos de nómina.',
        action: accionVacio,
      }}
      mobileCard={(e) => ({
        primary: e.nombre,
        secondary: [e.cedula, e.cargo].filter(Boolean).join(' · '),
        status: <StatusChips activo={e.activo} />,
        amount: (
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {salarioEnMoneda(e)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {`Este mes ${formatUsd(pagadoMes[e.id] ?? 0)}`}
            </Typography>
          </Box>
        ),
        actions: (
          <RowActionsMenu
            label={`empleado ${e.nombre}`}
            actions={acciones(e)}
            pending={e.id === pendienteId}
            size="small"
          />
        ),
      })}
    />
  )
}
