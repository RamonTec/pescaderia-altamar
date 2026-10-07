'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BlockIcon from '@mui/icons-material/BlockOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import { DataGrid, type GridColDef, type GridRowParams, GridToolbarQuickFilter } from '@mui/x-data-grid'
import { StatusChips } from '@/components/molecules/StatusChips'
import { EmptyState } from '@/components/molecules/EmptyState'
import { enmascararCuenta } from '@/lib/bancosVe'
import type { ProveedorResumen } from '@/lib/repositories/interfaces'

export interface ProveedoresTableProps {
  proveedores: ProveedorResumen[]
  esAdmin: boolean
  onEdit: (proveedor: ProveedorResumen) => void
  onBloquear: (proveedor: ProveedorResumen) => void
  onDesactivar: (proveedor: ProveedorResumen) => void
  onActivar: (proveedor: ProveedorResumen) => void
  onDesbloquear: (proveedor: ProveedorResumen) => void
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

export function ProveedoresTable({
  proveedores,
  esAdmin,
  onEdit,
  onBloquear,
  onDesactivar,
  onActivar,
  onDesbloquear,
}: ProveedoresTableProps) {
  const router = useRouter()
  const [soloActivos, setSoloActivos] = React.useState(true)
  const [menuAnchor, setMenuAnchor] = React.useState<null | { el: HTMLElement; row: ProveedorResumen }>(null)

  const filas = React.useMemo(() => {
    const base = soloActivos ? proveedores.filter((p) => p.activo) : proveedores
    return base.map((p) => ({ ...p, id: p.id }))
  }, [proveedores, soloActivos])

  const cerrarMenu = () => setMenuAnchor(null)

  const columns: GridColDef[] = [
    {
      field: 'nombre',
      headerName: 'Nombre',
      flex: 1.5,
      minWidth: 180,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2">{params.row.nombre}</Typography>
          {params.row.rif_ci ? (
            <Typography variant="caption" color="text.secondary">
              {params.row.rif_ci}
            </Typography>
          ) : null}
        </Box>
      ),
    },
    {
      field: 'estado',
      headerName: 'Estado',
      flex: 0.9,
      minWidth: 130,
      renderCell: (params) => (
        <StatusChips
          bloqueado={params.row.bloqueado}
          motivoBloqueo={params.row.motivo_bloqueo}
          activo={params.row.activo}
        />
      ),
    },
    { field: 'telefono', headerName: 'Teléfono', flex: 1, minWidth: 120 },
    {
      field: 'contacto_nombre',
      headerName: 'Contacto',
      flex: 1,
      minWidth: 130,
      valueGetter: (_v, row) => row.contacto_nombre ?? '—',
    },
    {
      field: 'pago',
      headerName: 'Método preferido',
      flex: 1,
      minWidth: 150,
      valueGetter: (_v, row) => metodoPreferidoLabel(row) ?? '—',
    },
    {
      field: 'saldo',
      headerName: 'Saldo pendiente',
      flex: 1,
      minWidth: 130,
      valueGetter: () => '—',
    },
    {
      field: 'acciones',
      headerName: '',
      sortable: false,
      filterable: false,
      width: 60,
      renderCell: (params) => (
        <IconButton
          aria-label="Acciones"
          size="small"
          onClick={(e) => setMenuAnchor({ el: e.currentTarget, row: params.row as ProveedorResumen })}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ]

  const handleRowClick = (params: GridRowParams) => {
    router.push(`/proveedores/${params.row.id}`)
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={!soloActivos}
              onChange={(e) => setSoloActivos(!e.target.checked)}
            />
          }
          label="Mostrar inactivos"
        />
      </Box>

      {filas.length === 0 ? (
        <EmptyState
          title={soloActivos ? 'Aún no hay proveedores' : 'Sin resultados'}
          description={
            soloActivos
              ? 'No hay proveedores activos. Crea uno nuevo o activa "Mostrar inactivos".'
              : 'No hay proveedores registrados todavía.'
          }
        />
      ) : (
        <DataGrid
          rows={filas}
          columns={columns}
          autoHeight
          disableRowSelectionOnClick
          onRowClick={handleRowClick}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            columns: {
              columnVisibilityModel: {
                telefono: false,
                contacto_nombre: false,
                pago: false,
                saldo: false,
              },
            },
          }}
          slots={{
            toolbar: () => <GridToolbarQuickFilter debounceMs={250} />,
            noRowsOverlay: () => (
              <EmptyState title="Sin resultados" description="No hay proveedores que coincidan." />
            ),
          }}
          sx={{ bgcolor: 'background.paper' }}
        />
      )}

      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={!!menuAnchor}
        onClose={cerrarMenu}
      >
        {menuAnchor ? (
          <>
            <MenuItem
              onClick={() => {
                const row = menuAnchor.row
                cerrarMenu()
                router.push(`/proveedores/${row.id}`)
              }}
            >
              <ListItemText>Ver ficha</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                const row = menuAnchor.row
                cerrarMenu()
                onEdit(row)
              }}
            >
              <ListItemIcon>
                <EditOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Editar</ListItemText>
            </MenuItem>
            {esAdmin ? (
              menuAnchor.row.bloqueado ? (
                <MenuItem
                  onClick={() => {
                    const row = menuAnchor.row
                    cerrarMenu()
                    onDesbloquear(row)
                  }}
                >
                  <ListItemIcon>
                    <LockOpenOutlinedIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText>Desbloquear</ListItemText>
                </MenuItem>
              ) : (
                <MenuItem
                  onClick={() => {
                    const row = menuAnchor.row
                    cerrarMenu()
                    onBloquear(row)
                  }}
                >
                  <ListItemIcon>
                    <LockOutlinedIcon fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText>Bloquear</ListItemText>
                </MenuItem>
              )
            ) : null}
            {menuAnchor.row.activo ? (
              <MenuItem
                onClick={() => {
                  const row = menuAnchor.row
                  cerrarMenu()
                  onDesactivar(row)
                }}
              >
                <ListItemIcon>
                  <BlockIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Desactivar</ListItemText>
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  const row = menuAnchor.row
                  cerrarMenu()
                  onActivar(row)
                }}
              >
                <ListItemIcon>
                  <LockOpenOutlinedIcon fontSize="small" color="success" />
                </ListItemIcon>
                <ListItemText>Activar</ListItemText>
              </MenuItem>
            )}
          </>
        ) : null}
      </Menu>
    </Box>
  )
}
