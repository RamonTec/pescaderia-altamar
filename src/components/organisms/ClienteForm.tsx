'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { ClienteFormFields } from '@/components/molecules/ClienteFormFields'
import { RepresentantesLegalesFieldArray } from '@/components/molecules/RepresentantesLegalesFieldArray'
import { DocumentoUpload } from '@/components/molecules/DocumentoUpload'
import { AppDialog } from '@/components/organisms/AppDialog'
import { representanteLegalRepository } from '@/lib/repositories/representanteLegalRepository'
import { makeClienteDocumentoStore } from '@/lib/repositories/documentoClienteRepository'
import { clienteFormSchema, type ClienteFormValues } from '@/lib/clienteValidation'
import type { Cliente, TipoDocumentoCliente } from '@/types/domain'
import { upsertClienteAction } from '@/app/(protected)/clientes/actions'
import { useNotify } from '@/lib/useNotify'

export interface ClienteFormProps {
  open: boolean
  cliente: Cliente | null
  onClose: () => void
  /** Tras crear/actualizar con éxito (ej. `router.refresh()` en la ficha). */
  onGuardado?: () => void
  /** Días de crédito del negocio, para el placeholder "Por defecto: 15" (09). */
  diasCreditoDefault?: number
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
      dias_credito: null,
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
    dias_credito: cliente.dias_credito ?? null,
    representantes: [],
  }
}

/**
 * Formulario de referencia de la Fase 2 (spec § Botones y acciones en curso,
 * § Modales): `AppDialog md` + `Button loading` + `useForm({ disabled })`.
 * Mientras guarda: campos y "Cancelar" deshabilitados, el diálogo no se
 * cierra y un segundo envío se ignora.
 */
export function ClienteForm({
  open,
  cliente,
  onClose,
  onGuardado,
  diasCreditoDefault = 15,
}: ClienteFormProps) {
  const notify = useNotify()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const methods = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteFormSchema),
    mode: 'onSubmit',
    defaultValues: toFormValues(cliente),
    disabled: isPending,
  })

  const {
    handleSubmit,
    reset,
    formState: { isDirty },
  } = methods
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

  // Doble envío: `isPending` del cierre no cambia hasta el re-render (y la
  // validación de `handleSubmit` es async), así que dos clics rápidos verían
  // `false` los dos. La ref se marca de forma síncrona.
  const submittingRef = React.useRef(false)

  const guardar = (values: ClienteFormValues) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setServerError(null)
    startTransition(async () => {
      try {
        const payload = JSON.stringify(values)
        const formData = new FormData()
        if (cliente) formData.set('id', cliente.id)
        formData.set('payload', payload)

        const result = await upsertClienteAction({ error: null, success: null }, formData)
        if (result.error) {
          setServerError(result.error)
        } else {
          notify.success(result.success ?? (cliente ? 'Cliente actualizado' : 'Cliente guardado'))
          onGuardado?.()
          onClose()
        }
      } finally {
        submittingRef.current = false
      }
    })
  }

  // `handleSubmit` se arma en el evento (no en el render) para que la ref
  // solo se lea al enviar.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit(guardar)(e)

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      size="md"
      title={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      subtitle={cliente ? cliente.nombre : undefined}
      onSubmit={onSubmit}
      pending={isPending}
      dirty={isDirty}
      error={serverError}
      primaryAction={
        <Button type="submit" variant="contained" loading={isPending}>
          {cliente ? 'Actualizar cliente' : 'Guardar cliente'}
        </Button>
      }
    >
      <FormProvider {...methods}>
        <Box sx={{ display: 'grid', gap: 4 }}>
          <ClienteFormFields diasCreditoDefault={diasCreditoDefault} />
          {tipoPersona === 'juridica' ? <RepresentantesLegalesFieldArray /> : null}
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="h6" component="h3">
              Documentos
            </Typography>
            {cliente ? (
              <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
              >
                <DocumentoUpload
                  store={makeClienteDocumentoStore(cliente.id)}
                  tipo={'cedula' as TipoDocumentoCliente}
                  disabled={isPending}
                  label="Cédula"
                />
                <DocumentoUpload
                  store={makeClienteDocumentoStore(cliente.id)}
                  tipo={'rif' as TipoDocumentoCliente}
                  disabled={isPending}
                  label="RIF"
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Podrás adjuntar la cédula y el RIF después de crear el cliente.
              </Typography>
            )}
          </Box>
        </Box>
      </FormProvider>
    </AppDialog>
  )
}
