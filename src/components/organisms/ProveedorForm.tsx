'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useForm, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import StepLabel from '@mui/material/StepLabel'
import Fade from '@mui/material/Fade'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { ProveedorIdentificacionFields } from '@/components/molecules/ProveedorIdentificacionFields'
import { MetodosPagoFieldArray } from '@/components/molecules/MetodosPagoFieldArray'
import { DocumentosRequeridos } from '@/components/molecules/DocumentosRequeridos'
import { AppDialog } from '@/components/organisms/AppDialog'
import { makeProveedorDocumentoStore } from '@/lib/repositories/documentoProveedorRepository'
import {
  proveedorFormSchema,
  CAMPOS_POR_PASO,
  type ProveedorFormValues,
} from '@/lib/proveedorValidation'
import type { Proveedor } from '@/types/domain'
import { upsertProveedorAction } from '@/app/(protected)/proveedores/actions'
import type { DatosEdicionProveedor } from '@/app/(protected)/proveedores/useProveedorAcciones'
import { useNotify } from '@/lib/useNotify'

export interface ProveedorFormProps {
  open: boolean
  proveedor: Proveedor | null
  onClose: () => void
  /** Tras crear/actualizar con éxito (ej. `router.refresh()` en la ficha). */
  onGuardado?: () => void
  /** Paso inicial (la usa "Completar documentos": abre en el paso 3). */
  pasoInicial?: number
  /**
   * Representantes y documentos ya cargados por quien abre el form (la ficha
   * y el listado los traen del servidor; `ProveedorResumen` los incluye).
   * Sin `proveedor` no aplica; con `proveedor` y sin datos, los pasos 1 y 3
   * arrancan vacíos (nunca se consultan desde el navegador).
   */
  datosEdicion?: DatosEdicionProveedor | null
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

/**
 * Formulario de proveedor sobre `AppDialog md` (spec § Modales): conserva el
 * Stepper de 3 pasos con su pie de navegación (Anterior / Siguiente /
 * "Guardar y continuar" / Finalizar). Mientras guarda: campos deshabilitados
 * (`useForm({ disabled })`), el diálogo no se cierra y el doble envío se
 * ignora (ref síncrona, leída en el handler del evento). Cerrar con cambios
 * sucios pide "¿Descartar cambios?" (lo gestiona AppDialog).
 */
export function ProveedorForm({
  open,
  proveedor,
  onClose,
  onGuardado,
  pasoInicial = 0,
  datosEdicion = null,
}: ProveedorFormProps) {
  const notify = useNotify()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [isPending] = useTransition()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [paso, setPaso] = React.useState(pasoInicial)
  // "Guardar y continuar" crea y avanza sin cerrar: conserva el id creado.
  const [idCreado, setIdCreado] = React.useState<string | null>(proveedor?.id ?? null)

  const methods = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorFormSchema),
    mode: 'onSubmit',
    defaultValues: vacio(),
    disabled: isPending,
  })

  const { handleSubmit, reset, formState } = methods
  const tipoPersona = useWatch({ control: methods.control, name: 'tipo_persona' })
  const esEdicion = !!proveedor

  // Doble envío: `isPending` del transition no cambia hasta el re-render (y
  // la validación de `handleSubmit` es async), así que dos clics rápidos
  // verían `false` los dos. La ref se lee solo dentro del handler del evento.
  const submittingRef = React.useRef(false)

  React.useEffect(() => {
    if (!open) return

    const base = proveedor ? toFormValues(proveedor) : vacio()

    if (!proveedor || !datosEdicion) {
      // Alta (sin datos previos) o edición sin datos: representantes vacíos,
      // sin consultas desde el navegador.
      reset(base)
      return
    }

    // Datos traídos por quien abre el form (ficha o listado: carga en
    // servidor; `ProveedorResumen` los incluye). Sin `createClient` aquí.
    reset({
      ...base,
      representantes: datosEdicion.representantes.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        cedula: r.cedula,
        cargo: '',
        telefono: '',
      })),
    })
  }, [open, proveedor, datosEdicion, reset])

  /** Salta al paso del primer `fieldError` del servidor y lo marca en el campo. */
  const aplicarErroresDeServidor = (fieldErrors: Record<string, string>): number => {
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
      methods.setError(campo as keyof ProveedorFormValues, { type: 'server', message: mensaje })
    }
    return aplicado ? primerPasoConError : 0
  }

  /** Cuerpo común de envío (solo dentro de un handler, nunca en el render). */
  const enviar = async (values: ProveedorFormValues): Promise<{ error: string | null }> => {
    if (submittingRef.current) return { error: 'guardando' }
    submittingRef.current = true
    setServerError(null)

    const payload = JSON.stringify(values)
    const formData = new FormData()
    if (proveedor) formData.set('id', proveedor.id)
    formData.set('payload', payload)

    try {
      const result = await upsertProveedorAction({ error: null, success: null }, formData)
      if (result.error) {
        setServerError(result.error)
        if (result.fieldErrors) setPaso(aplicarErroresDeServidor(result.fieldErrors))
        return { error: result.error }
      }
      // "Guardar y continuar" crea y avanza sin cerrar: conserva el id.
      if (result.id) setIdCreado(result.id)
      notify.success(result.success ?? 'Proveedor guardado')
      onGuardado?.()
      return { error: null }
    } catch {
      setServerError('No se pudo guardar el proveedor. Revisa tu conexión e intenta de nuevo.')
      return { error: 'conexion' }
    } finally {
      submittingRef.current = false
    }
  }

  const guardar = async (values: ProveedorFormValues) => {
    const { error } = await enviar(values)
    // Edición: cierra tras guardar. Alta: "Guardar y continuar" avanza sin cerrar.
    if (esEdicion && !error) onClose()
  }

  const guardarYContinuar = async (values: ProveedorFormValues) => {
    const { error } = await enviar(values)
    if (!error) setPaso(2)
  }

  // `handleSubmit` se arma en el evento (no en el render), como ClienteForm.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit(guardar)(e)
  const onGuardarYContinuar = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    void handleSubmit(guardarYContinuar)()
  }

  // Representantes y documentos del paso 3: llegan por props (servidor).
  const representantes = datosEdicion?.representantes ?? []
  const tiposPresentes = datosEdicion?.tiposDocumento ?? new Set()
  const conCedula = datosEdicion?.representanteConCedula ?? new Set<string>()

  // Pie del Stepper (Anterior / Siguiente / "Guardar y continuar" /
  // Finalizar): entra por la prop de pie custom de AppDialog. "Cancelar"
  // pide confirmación si hay cambios (lo gestiona `AppDialog dirty`).
  const pieStepper = (
    <>
      <Button onClick={onClose} disabled={isPending} color="inherit" sx={{ color: 'text.secondary' }}>
        Cancelar
      </Button>
      <Box sx={{ flexGrow: 1 }} />
      {paso > 0 && !esEdicion ? (
        <Button onClick={() => setPaso((p) => p - 1)} disabled={isPending}>
          Anterior
        </Button>
      ) : null}
      {esEdicion ? (
        <Button type="submit" variant="contained" loading={isPending}>
          Guardar proveedor
        </Button>
      ) : paso === 0 ? (
        <Button onClick={() => setPaso((p) => Math.min(p + 1, PASOS.length - 1))} variant="contained" loading={isPending}>
          Siguiente
        </Button>
      ) : paso === 1 ? (
        <Button onClick={onGuardarYContinuar} variant="contained" loading={isPending}>
          Guardar y continuar
        </Button>
      ) : (
        <Button onClick={onClose} variant="contained" loading={isPending}>
          Finalizar
        </Button>
      )}
    </>
  )

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      title={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      subtitle={proveedor ? proveedor.nombre : 'Registra contacto, métodos de pago y documentos.'}
      onSubmit={onSubmit}
      pending={isPending}
      dirty={formState.isDirty}
      error={serverError}
      footer={pieStepper}
    >
      <FormProvider {...methods}>
        <Stepper
          activeStep={paso}
          alternativeLabel={!fullScreen}
          nonLinear={esEdicion}
          sx={{ mb: 3 }}
        >
          {PASOS.map((label, i) => (
            <Step key={label}>
              {esEdicion ? (
                <StepButton onClick={() => setPaso(i)} disabled={isPending}>
                  {label}
                </StepButton>
              ) : (
                <StepLabel>{label}</StepLabel>
              )}
            </Step>
          ))}
        </Stepper>

        <Fade
          in
          key={paso}
          timeout={{ enter: theme.transitions.duration.short, exit: theme.transitions.duration.shortest }}
        >
          <Box sx={{ display: 'grid', gap: 3 }}>
            {paso === 0 ? (
              <ProveedorIdentificacionFields />
            ) : paso === 1 ? (
              <MetodosPagoFieldArray />
            ) : (
              <DocumentosRequeridos
                tipoPersona={tipoPersona}
                representantes={representantes}
                makeStore={(representanteId) =>
                  makeProveedorDocumentoStore(idCreado ?? proveedor?.id ?? '', representanteId)
                }
                tiposPresentes={tiposPresentes}
                representanteConCedula={conCedula}
                disabled={isPending}
              />
            )}
          </Box>
        </Fade>
      </FormProvider>
    </AppDialog>
  )
}