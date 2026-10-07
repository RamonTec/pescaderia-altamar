'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import BlockIcon from '@mui/icons-material/Block'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { EmptyState } from '@/components/molecules/EmptyState'
import type { Cliente } from '@/types/domain'
import {
  desactivarClienteAction,
  activarClienteAction,
  bloquearClienteAction,
  desbloquearClienteAction,
} from '@/app/(protected)/clientes/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface ClientesTableProps {
  clientes: Cliente[]
  esAdmin: boolean
  onEdit: (cliente: Cliente) => void
}

export function ClientesTable({ clientes, esAdmin, onEdit }: ClientesTableProps) {
  const router = useRouter()
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()

  const [soloActivos, setSoloActivos] = React.useState(true)
  const [bloquearTarget, setBloquearTarget] = React.useState<Cliente | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const filas = React.useMemo(() => {
    const base = soloActivos ? clientes.filter((c) => c.activo) : clientes
    return base.map((c) => ({ ...c, id: c.id }))
  }, [clientes, soloActivos])

  const runAction = (
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

  const handleDesactivar = async (cliente: Cliente) => {
    const ok = await confirm({
      title: 'Desactivar cliente',
      message: `¿Desactivar a "${cliente.nombre}"? No se podrá usar en nuevas ventas.`,
      confirmLabel: 'Desactivar',
      destructive: true,
    })
    if (!ok) return
    runAction(desactivarClienteAction, cliente.id)
  }

  const handleActivar = (cliente: Cliente) => {
    runAction(activarClienteAction, cliente.id)
  }

  const handleBloquear = (cliente: Cliente) => {
    setBloquearTarget(cliente)
    setMotivo('')
  }

  const confirmBloquear = () => {
    if (!bloquearTarget) return
    if (!motivo.trim()) {
      notify.error('El motivo de bloqueo es obligatorio')
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set('id', bloquearTarget.id)
      formData.set('motivo', motivo)
      const result = await bloquearClienteAction({ error: null, success: null }, formData)
      if (result.error) notify.error(result.error)
      else notify.success(result.success ?? 'Cliente bloqueado')
      setBloquearTarget(null)
    })
  }

  const handleDesbloquear = (cliente: Cliente) => {
    runAction(desbloquearClienteAction, cliente.id)
  }

  const columns: GridColDef[] = [
    { field: 'nombre', headerName: 'Nombre', flex: 1.5, minWidth: 180 },
    { field: 'rif_ci', headerName: 'RIF / Cédula', flex: 1, minWidth: 130 },
    { field: 'telefono', headerName: 'Teléfono', flex: 1, minWidth: 120 },
    {
      field: 'saldo',
      headerName: 'Saldo pendiente',
      flex: 1,
      minWidth: 130,
      valueGetter: () => '—',
    },
    {
      field: 'bloqueado',
      headerName: 'Estado',
      flex: 0.8,
      minWidth: 110,
      renderCell: (params) =>
        params.row.bloqueado ? (
          <Chip label="Bloqueado" size="small" color="error" />
        ) : params.row.activo ? (
          <Chip label="Activo" size="small" color="success" variant="outlined" />
        ) : (
          <Chip label="Inactivo" size="small" color="default" variant="outlined" />
        ),
    },
    {
      field: 'acciones',
      headerName: '',
      sortable: false,
      filterable: false,
      width: 140,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Ver ficha">
            <IconButton
              aria-label="Ver ficha"
              size="small"
              onClick={() => router.push(`/clientes/${params.row.id}`)}
            >
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Editar">
            <IconButton
              aria-label="Editar"
              size="small"
              onClick={() => onEdit(params.row as Cliente)}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {esAdmin ? (
            params.row.bloqueado ? (
              <Tooltip title="Desbloquear">
                <IconButton
                  aria-label="Desbloquear"
                  size="small"
                  color="success"
                  onClick={() => handleDesbloquear(params.row as Cliente)}
                >
                  <LockOpenOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Bloquear">
                <IconButton
                  aria-label="Bloquear"
                  size="small"
                  color="warning"
                  onClick={() => handleBloquear(params.row as Cliente)}
                >
                  <LockOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )
          ) : null}
          {params.row.activo ? (
            <Tooltip title="Desactivar">
              <IconButton
                aria-label="Desactivar"
                size="small"
                color="error"
                onClick={() => handleDesactivar(params.row as Cliente)}
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
                onClick={() => handleActivar(params.row as Cliente)}
              >
                <LockOpenOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ]

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={soloActivos ? 'activos' : 'todos'}
          onChange={(_, next) => next && setSoloActivos(next === 'activos')}
        >
          <ToggleButton value="activos">Activos</ToggleButton>
          <ToggleButton value="todos">Todos</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {filas.length === 0 ? (
        <EmptyState
          title="Aún no hay clientes"
          description={
            soloActivos
              ? 'No hay clientes activos. Crea uno nuevo o cambia a "Todos".'
              : 'No hay clientes registrados todavía.'
          }
        />
      ) : (
        <DataGrid
          rows={filas}
          columns={columns}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ bgcolor: 'background.paper' }}
        />
      )}

      <Dialog
        open={!!bloquearTarget}
        onClose={() => setBloquearTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Bloquear cliente</DialogTitle>
        <DialogContent>
          <TextField
            label="Motivo del bloqueo"
            fullWidth
            multiline
            minRows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBloquearTarget(null)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={confirmBloquear}
            color="error"
            variant="contained"
            disabled={isPending}
          >
            Bloquear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
