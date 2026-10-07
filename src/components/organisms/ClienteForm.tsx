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
import { ClienteFormFields } from '@/components/molecules/ClienteFormFields'
import { RepresentantesLegalesFieldArray } from '@/components/molecules/RepresentantesLegalesFieldArray'
import { DocumentoUpload } from '@/components/molecules/DocumentoUpload'
import { representanteLegalRepository } from '@/lib/repositories/representanteLegalRepository'
import {
  clienteFormSchema,
  type ClienteFormValues,
} from '@/lib/clienteValidation'
import type { Cliente, TipoDocumentoCliente } from '@/types/domain'
import { upsertClienteAction } from '@/app/(protected)/clientes/actions'
import { useNotify } from '@/lib/useNotify'

export interface ClienteFormProps {
  open: boolean
  cliente: Cliente | null
  onClose: () => void
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

export function ClienteForm({ open, cliente, onClose }: ClienteFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteFormSchema),
    mode: 'onSubmit',
    defaultValues: toFormValues(cliente),
  })

  const { handleSubmit, reset } = methods
  const tipoPersona = useWatch({ control: methods.control, name: 'tipo_persona' })

  const handleClose = () => {
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
        onClose()
      }
    })
  })

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <DialogTitle>{cliente ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'grid', gap: 3 }}>
              <ClienteFormFields />
              {tipoPersona === 'juridica' ? <RepresentantesLegalesFieldArray /> : null}
              {cliente ? (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <DocumentoUpload
                      clienteId={cliente.id}
                      tipo={'cedula' as TipoDocumentoCliente}
                      label="Documento de cédula"
                    />
                    <DocumentoUpload
                      clienteId={cliente.id}
                      tipo={'rif' as TipoDocumentoCliente}
                      label="Documento de RIF"
                    />
                  </Box>
                </Box>
              ) : (
                <Box
                  component="p"
                  sx={{ color: 'text.secondary', m: 0, fontSize: 'caption.fontSize' }}
                >
                  Guarda el cliente para poder adjuntar documentos (cédula/RIF).
                </Box>
              )}
              {serverError ? <Alert severity="error">{serverError}</Alert> : null}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isPending}
              startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {cliente ? 'Guardar' : 'Crear'}
            </Button>
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  )
}
