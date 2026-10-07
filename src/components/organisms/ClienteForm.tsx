'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Alert from '@mui/material/Alert'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { ClienteFormFields } from '@/components/molecules/ClienteFormFields'
import { RepresentantesLegalesFieldArray } from '@/components/molecules/RepresentantesLegalesFieldArray'
import { DocumentoUpload } from '@/components/molecules/DocumentoUpload'
import { representanteLegalRepository } from '@/lib/repositories/representanteLegalRepository'
import { makeClienteDocumentoStore } from '@/lib/repositories/documentoClienteRepository'
import {
  clienteFormSchema,
  type ClienteFormValues,
} from '@/lib/clienteValidation'
import type { Cliente, TipoDocumentoCliente } from '@/types/domain'
import { upsertClienteAction } from '@/app/(protected)/clientes/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface ClienteFormProps {
  open: boolean
  cliente: Cliente | null
  onClose: () => void
  /** Tras crear/actualizar con éxito (ej. `router.refresh()` en la ficha). */
  onGuardado?: () => void
}

function toFormValues(cliente: Cliente | null): ClienteFormValues {
  if (!cliente) {
    return {
      nombre: '',
      tipo_persona: 'natural',
      rif_ci: '',
      telefono: '',
      email: '',
      direccion: '',
      notas: '',
      limite_credito_usd: null,
      representantes: [],
    }
  }
  return {
    nombre: cliente.nombre,
    tipo_persona: cliente.tipo_persona,
    rif_ci: cliente.rif_ci ?? '',
    telefono: cliente.telefono ?? '',
    email: cliente.email ?? '',
    direccion: cliente.direccion ?? '',
    notas: cliente.notas ?? '',
    limite_credito_usd: cliente.limite_credito_usd,
    representantes: [],
  }
}

export function ClienteForm({ open, cliente, onClose, onGuardado }: ClienteFormProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteFormSchema),
    mode: 'onSubmit',
    defaultValues: toFormValues(cliente),
  })

  const {
    handleSubmit,
    reset,
    formState: { isDirty },
  } = methods
  const tipoPersona = useWatch({ control: methods.control, name: 'tipo_persona' })

  const handleClose = async () => {
    if (isPending) return
    if (isDirty) {
      const ok = await confirm({
        title: 'Descartar cambios',
        message: 'Los datos que escribiste no se van a guardar.',
        confirmLabel: 'Descartar',
        destructive: true,
      })
      if (!ok) return
    }
    setServerError(null)
    onClose()
  }

  React.useEffect(() => {
    if (!open) return

    const base = toFormValues(cliente)
    if (cliente) {
      representanteLegalRepository
        .listByCliente(cliente.id)
        .then((reps) => {
          reset({
            ...base,
            representantes: reps.map((r) => ({
              id: r.id,
              nombre: r.nombre,
              cedula: r.cedula,
              cargo: r.cargo ?? '',
              telefono: r.telefono ?? '',
            })),
          })
        })
        .catch(() => {
          reset(base)
        })
    } else {
      reset(base)
    }
  }, [open, cliente, reset])

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const payload = JSON.stringify(values)
      const formData = new FormData()
      if (cliente) formData.set('id', cliente.id)
      formData.set('payload', payload)

      const result = await upsertClienteAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
      } else {
        notify.success(result.success ?? 'Guardado')
        onGuardado?.()
        onClose()
      }
    })
  })

  const titulo = cliente ? 'Editar cliente' : 'Nuevo cliente'

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      aria-labelledby="cliente-form-titulo"
    >
      <FormProvider {...methods}>
        <Box
          component="form"
          onSubmit={onSubmit}
          noValidate
          sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: fullScreen ? '100%' : undefined }}
        >
          <DialogTitle
            id="cliente-form-titulo"
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography variant="h5" component="span">
              {titulo}
            </Typography>
            <IconButton aria-label="Cerrar" onClick={handleClose} edge="end">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ flex: 1 }}>
            <Box sx={{ display: 'grid', gap: 4, py: 1 }}>
              <ClienteFormFields />
              {tipoPersona === 'juridica' ? <RepresentantesLegalesFieldArray /> : null}
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Typography variant="h6" component="h3">
                  Documentos
                </Typography>
                {cliente ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <DocumentoUpload
                      store={makeClienteDocumentoStore(cliente.id)}
                      tipo={'cedula' as TipoDocumentoCliente}
                      label="Cédula"
                    />
                    <DocumentoUpload
                      store={makeClienteDocumentoStore(cliente.id)}
                      tipo={'rif' as TipoDocumentoCliente}
                      label="RIF"
                    />
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Podrás adjuntar la cédula y el RIF después de crear el cliente.
                  </Typography>
                )}
              </Box>
              <Collapse in={!!serverError} unmountOnExit>
                <Alert severity="error">{serverError}</Alert>
              </Collapse>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isPending}
              startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {isPending ? 'Guardando…' : cliente ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  )
}
