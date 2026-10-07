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
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import StepLabel from '@mui/material/StepLabel'
import Alert from '@mui/material/Alert'
import Fade from '@mui/material/Fade'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { ProveedorIdentificacionFields } from '@/components/molecules/ProveedorIdentificacionFields'
import { MetodosPagoFieldArray } from '@/components/molecules/MetodosPagoFieldArray'
import { DocumentosRequeridos } from '@/components/molecules/DocumentosRequeridos'
import { makeRepresentanteProveedorRepository } from '@/lib/repositories/representanteProveedorRepository'
import { makeProveedorDocumentoStore } from '@/lib/repositories/documentoProveedorRepository'
import { makeDocumentoProveedorRepository } from '@/lib/repositories/documentoProveedorRepository'
import {
  proveedorFormSchema,
  CAMPOS_POR_PASO,
  type ProveedorFormValues,
} from '@/lib/proveedorValidation'
import type { Proveedor, TipoDocumentoProveedor } from '@/types/domain'
import { upsertProveedorAction } from '@/app/(protected)/proveedores/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface ProveedorFormProps {
  open: boolean
  proveedor: Proveedor | null
  onClose: () => void
  /** Paso inicial (la usa "Completar documentos"). */
  pasoInicial?: number
}

const PASOS = ['Identificación', 'Pagos', 'Documentos']

function vacio(): ProveedorFormValues {
  return {
    nombre: '',
    tipo_persona: 'juridica',
    rif_ci: '',
    telefono: '',
    email: '',
    direccion: '',
    contacto_nombre: '',
    contacto_telefono: '',
    notas: '',
    representantes: [],
    metodosPago: [],
  }
}

function toFormValues(p: Proveedor): ProveedorFormValues {
  return {
    nombre: p.nombre,
    tipo_persona: p.tipo_persona,
    rif_ci: p.rif_ci ?? '',
    telefono: p.telefono ?? '',
    email: p.email ?? '',
    direccion: p.direccion ?? '',
    contacto_nombre: p.contacto_nombre ?? '',
    contacto_telefono: p.contacto_telefono ?? '',
    notas: p.notas ?? '',
    representantes: [],
    metodosPago: [],
  }
}

export function ProveedorForm({ open, proveedor, onClose, pasoInicial = 0 }: ProveedorFormProps) {
  const notify = useNotify()
  const confirm = useConfirm()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [paso, setPaso] = React.useState(pasoInicial)
  const [idCreado, setIdCreado] = React.useState<string | null>(proveedor?.id ?? null)
  const [representantesGuardados, setRepresentantesGuardados] = React.useState<
    { id: string; nombre: string; cedula: string }[]
  >([])
  const [docsCargados, setDocsCargados] = React.useState<{
    tipos: Set<TipoDocumentoProveedor>
    conRep: Set<string>
  }>({ tipos: new Set(), conRep: new Set() })

  const methods = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(),
  })

  const { handleSubmit, reset, trigger, formState } = methods
  const tipoPersona = useWatch({ control: methods.control, name: 'tipo_persona' })
  const esEdicion = !!proveedor

  const handleClose = () => {
    setServerError(null)
    onClose()
  }

  const pedirCierre = async () => {
    if (formState.isDirty) {
      const ok = await confirm({
        title: '¿Descartar cambios?',
        message: 'Hay cambios sin guardar. ¿Descartarlos?',
        confirmLabel: 'Descartar',
        destructive: true,
      })
      if (!ok) return
    }
    handleClose()
  }

  React.useEffect(() => {
    if (!open || !proveedor) return
    const base = toFormValues(proveedor)

    Promise.all([
      makeRepresentanteProveedorRepository().listByProveedor(proveedor.id),
      makeDocumentoProveedorRepository().listByProveedor(proveedor.id),
    ])
      .then(([reps, docs]) => {
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
        setRepresentantesGuardados(reps.map((r) => ({ id: r.id, nombre: r.nombre, cedula: r.cedula })))
        setDocsCargados({
          tipos: new Set(docs.map((d) => d.tipo)),
          conRep: new Set(docs.filter((d) => d.representante_id).map((d) => d.representante_id!)),
        })
      })
      .catch(() => reset(base))
  }, [open, proveedor, reset])

  const aplicarErroresDeServidor = (
    fieldErrors: Record<string, string>
  ): number => {
    let primerPasoConError = 0
    let aplicado = false
    for (const [campo, mensaje] of Object.entries(fieldErrors)) {
      for (let i = 0; i < CAMPOS_POR_PASO.length; i++) {
        const campos = CAMPOS_POR_PASO[i]
        if (campos.some((c) => campo === c || campo.startsWith(c + '.'))) {
          if (!aplicado) {
            primerPasoConError = i
            aplicado = true
          }
          break
        }
      }
      // @ts-expect-error setError con path dinámico
      methods.setError(campo, { type: 'server', message: mensaje })
    }
    return aplicado ? primerPasoConError : 0
  }

  const guardar = (values: ProveedorFormValues): Promise<{ error: string | null }> => {
    const payload = JSON.stringify(values)
    const formData = new FormData()
    if (proveedor) formData.set('id', proveedor.id)
    formData.set('payload', payload)

    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await upsertProveedorAction({ error: null, success: null }, formData)
        if (result.error) {
          setServerError(result.error)
          if (result.fieldErrors) {
            const pasoError = aplicarErroresDeServidor(result.fieldErrors)
            setPaso(pasoError)
          }
          resolve({ error: result.error })
          return
        }
        if (result.id) setIdCreado(result.id)
        notify.success(result.success ?? 'Guardado')
        resolve({ error: null })
      })
    })
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    const { error } = await guardar(values)
    if (proveedor) {
      if (!error) onClose()
    } else if (!error) {
      setPaso(2)
    }
  })

  const guardarYContinuar = handleSubmit(async (values) => {
    setServerError(null)
    const { error } = await guardar(values)
    if (!error) setPaso(2)
  })

  const handleNext = async () => {
    const valido = await trigger(CAMPOS_POR_PASO[paso] as (keyof ProveedorFormValues)[])
    if (!valido) return
    setPaso((p) => Math.min(p + 1, PASOS.length - 1))
  }

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : pedirCierre}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
    >
      <FormProvider {...methods}>
        <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', height: fullScreen ? '100%' : undefined }}>
          <DialogTitle>{proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>

          <Stepper activeStep={paso} alternativeLabel={!fullScreen} nonLinear={esEdicion}>
            {PASOS.map((label, i) => (
              <Step key={label}>
                {esEdicion ? (
                  <StepButton onClick={() => setPaso(i)}>{label}</StepButton>
                ) : (
                  <StepLabel>{label}</StepLabel>
                )}
              </Step>
            ))}
          </Stepper>

          <DialogContent dividers sx={{ flexGrow: 1 }}>
            <Fade in key={paso} timeout={{ enter: 200, exit: 100 }}>
              <Box sx={{ display: 'grid', gap: 3 }}>
                {paso === 0 ? (
                  <ProveedorIdentificacionFields />
                ) : paso === 1 ? (
                  <MetodosPagoFieldArray />
                ) : (
                  <DocumentosRequeridos
                    tipoPersona={tipoPersona}
                    representantes={representantesGuardados}
                    makeStore={(representanteId) =>
                      makeProveedorDocumentoStore(idCreado ?? proveedor?.id ?? '', representanteId)
                    }
                    tiposPresentes={docsCargados.tipos}
                    representanteConCedula={docsCargados.conRep}
                  />
                )}

                {serverError ? <Alert severity="error">{serverError}</Alert> : null}
              </Box>
            </Fade>
          </DialogContent>

          <DialogActions>
            <Button onClick={pedirCierre} disabled={isPending}>
              Cancelar
            </Button>
            {paso > 0 && !esEdicion ? (
              <Button onClick={() => setPaso((p) => p - 1)} disabled={isPending}>
                Anterior
              </Button>
            ) : null}

            {esEdicion ? (
              <Button type="submit" variant="contained" disabled={isPending}>
                Guardar
              </Button>
            ) : paso === 1 ? (
              <Button
                onClick={guardarYContinuar}
                variant="contained"
                disabled={isPending}
                startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : null}
              >
                Guardar y continuar
              </Button>
            ) : paso === 0 ? (
              <Button onClick={handleNext} variant="contained" disabled={isPending}>
                Siguiente
              </Button>
            ) : (
              <Button onClick={pedirCierre} variant="contained" disabled={isPending}>
                Finalizar
              </Button>
            )}
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  )
}
