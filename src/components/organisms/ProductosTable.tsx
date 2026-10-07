'use client'

import * as React from 'react'
import { useTransition } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'
import { DataGrid, type GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BlockIcon from '@mui/icons-material/BlockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'
import type { Producto } from '@/types/domain'
import {
  desactivarProductoAction,
  activarProductoAction,
} from '@/app/(protected)/catalogos/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface ProductosTableProps {
  productos: Producto[]
  esAdmin: boolean
  onEdit: (producto: Producto) => void
}

export function ProductosTable({ productos, esAdmin, onEdit }: ProductosTableProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()

  const [soloActivos, setSoloActivos] = React.useState(true)

  const filas = React.useMemo(() => {
    const base = soloActivos ? productos.filter((p) => p.activo) : productos
    return base.map((p) => ({ ...p, id: p.id }))
  }, [productos, soloActivos])

  const run = (
    fn: (
      prev: { error: string | null; success: string | null },
      formData: FormData
    ) => Promise<{ error: string | null; success: string | null }>,
    id: string
  ) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('id', id)
      const result = await fn({ error: null, success: null }, formData)
      if (result.error) notify.error(result.error)
      else notify.success(result.success ?? 'Listo')
    })
  }

  const handleDesactivar = async (p: Producto) => {
    const ok = await confirm({
      title: 'Desactivar producto',
      message: `¿Desactivar "${p.nombre}"? No se podrá usar en nuevas compras.`,
      confirmLabel: 'Desactivar',
      destructive: true,
    })
    if (!ok) return
    run(desactivarProductoAction, p.id)
  }

  const handleActivar = (p: Producto) => {
    run(activarProductoAction, p.id)
  }

  const nombrePorId = React.useMemo(
    () => new Map(productos.map((p) => [p.id, p.nombre])),
    [productos]
  )

  const columns: GridColDef[] = [
    {
      field: 'nombre',
      headerName: 'Nombre',
      flex: 1.5,
      minWidth: 180,
      renderCell: (params) => {
        const p = params.row as Producto
        if (p.tipo !== 'procesado') return p.nombre
        const origen = p.producto_origen_id ? nombrePorId.get(p.producto_origen_id) : null
        return (
          <Box>
            <Typography variant="body2">{p.nombre}</Typography>
            <Typography variant="caption" color={origen ? 'text.secondary' : 'warning.main'}>
              {origen ? `de ${origen}` : 'Sin crudo asignado'}
            </Typography>
          </Box>
        )
      },
    },
    {
      field: 'codigo',
      headerName: 'Código',
      flex: 0.7,
      minWidth: 100,
      valueGetter: (_v, row) => row.codigo ?? '—',
    },
    {
      field: 'tipo',
      headerName: 'Tipo',
      flex: 0.8,
      minWidth: 110,
      renderCell: (params) =>
        params.row.tipo === 'crudo' ? (
          <Chip label="Crudo" size="small" color="secondary" variant="outlined" />
        ) : (
          <Chip label="Procesado" size="small" color="primary" variant="outlined" />
        ),
    },
    {
      field: 'categoria',
      headerName: 'Categoría',
      flex: 0.9,
      minWidth: 120,
      valueGetter: (_v, row) => row.categoria ?? '—',
    },
    {
      field: 'controla_stock',
      headerName: 'Stock',
      flex: 0.7,
      minWidth: 100,
      renderCell: (params) =>
        params.row.controla_stock ? (
          <Chip label="Controla stock" size="small" />
        ) : (
          <Chip label="Sin stock" size="small" variant="outlined" />
        ),
    },
    {
      field: 'estado',
      headerName: 'Estado',
      flex: 0.7,
      minWidth: 100,
      renderCell: (params) =>
        params.row.activo ? (
          <Chip label="Activo" size="small" color="success" variant="outlined" />
        ) : (
          <Chip label="Inactivo" size="small" color="default" variant="outlined" />
        ),
    },
  ]

  if (esAdmin) {
    columns.push({
      field: 'acciones',
      headerName: '',
      sortable: false,
      filterable: false,
      width: 100,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Editar">
            <IconButton
              aria-label="Editar"
              size="small"
              onClick={() => onEdit(params.row as Producto)}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {params.row.activo ? (
            <Tooltip title="Desactivar">
              <IconButton
                aria-label="Desactivar"
                size="small"
                color="error"
                disabled={isPending}
                onClick={() => handleDesactivar(params.row as Producto)}
              >
                <BlockIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Activar">
              <IconButton
                aria-label="Activar"
                size="small"
                color="success"
                disabled={isPending}
                onClick={() => handleActivar(params.row as Producto)}
              >
                <LockOpenOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    })
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
          title={soloActivos ? 'Aún no hay productos' : 'Sin resultados'}
          description={
            soloActivos
              ? 'No hay productos activos. Crea uno nuevo o activa "Mostrar inactivos".'
              : 'No hay productos registrados todavía.'
          }
        />
      ) : (
        <DataGrid
          rows={filas}
          columns={columns}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            columns: {
              columnVisibilityModel: {
                categoria: false,
              },
            },
          }}
          slots={{
            toolbar: () => <GridToolbarQuickFilter debounceMs={250} />,
            noRowsOverlay: () => (
              <EmptyState title="Sin resultados" description="No hay productos que coincidan." />
            ),
          }}
          sx={{ bgcolor: 'background.paper' }}
        />
      )}
    </Box>
  )
}
