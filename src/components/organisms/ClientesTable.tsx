'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import SearchIcon from '@mui/icons-material/Search'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BlockIcon from '@mui/icons-material/Block'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'
import { StatusChips } from '@/components/molecules/StatusChips'
import { formatUsd } from '@/lib/format'
import type { Cliente } from '@/types/domain'

type Filtro = 'activos' | 'bloqueados' | 'todos'

export interface ClientesTableProps {
  clientes: Cliente[]
  esAdmin: boolean
  onEdit: (cliente: Cliente) => void
  onBloquear: (cliente: Cliente) => void
  onDesbloquear: (cliente: Cliente) => void
  onDesactivar: (cliente: Cliente) => void
  onActivar: (cliente: Cliente) => void
}

const MONO = { fontFamily: 'var(--font-geist-mono)', fontVariantNumeric: 'tabular-nums' }

/** Minúsculas, sin acentos ni separadores: "V-12.345" y "v12345" coinciden. */
function normalizar(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s.\-]/g, '')
}

export function ClientesTable({
  clientes,
  esAdmin,
  onEdit,
  onBloquear,
  onDesbloquear,
  onDesactivar,
  onActivar,
}: ClientesTableProps) {
  const router = useRouter()
  const theme = useTheme()
  const compacto = useMediaQuery(theme.breakpoints.down('sm'))

  const [filtro, setFiltro] = React.useState<Filtro>('activos')
  const [busqueda, setBusqueda] = React.useState('')
  const [menu, setMenu] = React.useState<{ el: HTMLElement; cliente: Cliente } | null>(null)

  const conteo = React.useMemo(
    () => ({
      activos: clientes.filter((c) => c.activo).length,
      bloqueados: clientes.filter((c) => c.bloqueado).length,
      todos: clientes.length,
    }),
    [clientes]
  )

  const filas = React.useMemo(() => {
    const q = normalizar(busqueda)
    return clientes.filter((c) => {
      if (filtro === 'activos' && !c.activo) return false
      if (filtro === 'bloqueados' && !c.bloqueado) return false
      if (!q) return true
      return [c.nombre, c.rif_ci, c.telefono].some((v) => normalizar(v).includes(q))
    })
  }, [clientes, filtro, busqueda])

  const cerrarMenu = () => setMenu(null)
  const desdeMenu = (fn: (c: Cliente) => void) => () => {
    if (!menu) return
    const { cliente } = menu
    cerrarMenu()
    fn(cliente)
  }

  const columns: GridColDef<Cliente>[] = [
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
          <Typography variant="caption" color="text.secondary" noWrap sx={MONO}>
            {row.rif_ci ?? 'Sin RIF / cédula'}
          </Typography>
        </Box>
      ),
    },
    { field: 'telefono', headerName: 'Teléfono', flex: 1, minWidth: 130, valueGetter: (v) => v ?? '—' },
    {
      field: 'limite_credito_usd',
      headerName: 'Crédito',
      type: 'number',
      flex: 0.8,
      minWidth: 120,
      renderCell: ({ value }) =>
        value ? (
          <Box component="span" sx={MONO}>
            {formatUsd(value)}
          </Box>
        ) : (
          <Typography variant="body2" component="span" color="text.secondary">
            Contado
          </Typography>
        ),
    },
    {
      field: 'estado',
      headerName: 'Estado',
      sortable: false,
      flex: 0.8,
      minWidth: 110,
      renderCell: ({ row }) => (
        <StatusChips bloqueado={row.bloqueado} motivoBloqueo={row.motivo_bloqueo} activo={row.activo} />
      ),
    },
    {
      field: 'acciones',
      headerName: '',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      width: 56,
      align: 'center',
      renderCell: ({ row }) => (
        <IconButton
          aria-label={`Acciones para ${row.nombre}`}
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            setMenu({ el: e.currentTarget, cliente: row })
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ]

  const sinClientes = clientes.length === 0

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {sinClientes ? null : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <TextField
            size="small"
            placeholder="Buscar por nombre, RIF o teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ width: { xs: '100%', sm: 340 } }}
            slotProps={{
              htmlInput: { 'aria-label': 'Buscar clientes' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filtro}
            onChange={(_, next: Filtro | null) => next && setFiltro(next)}
            aria-label="Filtrar clientes"
            sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}
          >
            <ToggleButton value="activos">Activos ({conteo.activos})</ToggleButton>
            <ToggleButton value="bloqueados">Bloqueados ({conteo.bloqueados})</ToggleButton>
            <ToggleButton value="todos">Todos ({conteo.todos})</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {sinClientes ? (
        <EmptyState
          title="Registra tu primer cliente"
          description="Con los clientes registrados podrás venderles a crédito, agendar pedidos y ver su historial."
        />
      ) : filas.length === 0 ? (
        <EmptyState
          icon={<PersonSearchOutlinedIcon fontSize="large" />}
          title="Ningún cliente coincide"
          description={
            busqueda
              ? `No hay clientes ${filtro === 'todos' ? '' : filtro + ' '}que coincidan con "${busqueda}".`
              : filtro === 'bloqueados'
                ? 'No hay clientes bloqueados.'
                : 'No hay clientes activos. Revisa la pestaña "Todos".'
          }
        />
      ) : (
        <DataGrid
          rows={filas}
          columns={columns}
          autoHeight
          rowHeight={60}
          disableRowSelectionOnClick
          disableColumnMenu
          onRowClick={({ row }) => router.push(`/clientes/${row.id}`)}
          columnVisibilityModel={{ telefono: !compacto, limite_credito_usd: !compacto }}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      )}

      <Menu anchorEl={menu?.el ?? null} open={!!menu} onClose={cerrarMenu}>
        {menu
          ? [
              <MenuItem key="editar" onClick={desdeMenu(onEdit)}>
                <ListItemIcon>
                  <EditOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Editar</ListItemText>
              </MenuItem>,
              esAdmin && menu.cliente.bloqueado ? (
                <MenuItem key="desbloquear" onClick={desdeMenu(onDesbloquear)}>
                  <ListItemIcon>
                    <LockOpenOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Desbloquear</ListItemText>
                </MenuItem>
              ) : null,
              esAdmin && !menu.cliente.bloqueado ? (
                <MenuItem key="bloquear" onClick={desdeMenu(onBloquear)}>
                  <ListItemIcon>
                    <LockOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Bloquear</ListItemText>
                </MenuItem>
              ) : null,
              menu.cliente.activo ? (
                <MenuItem key="desactivar" onClick={desdeMenu(onDesactivar)} sx={{ color: 'error.main' }}>
                  <ListItemIcon sx={{ color: 'inherit' }}>
                    <BlockIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Desactivar</ListItemText>
                </MenuItem>
              ) : (
                <MenuItem key="activar" onClick={desdeMenu(onActivar)}>
                  <ListItemIcon>
                    <CheckCircleOutlineIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Activar</ListItemText>
                </MenuItem>
              ),
            ]
          : null}
      </Menu>
    </Box>
  )
}
