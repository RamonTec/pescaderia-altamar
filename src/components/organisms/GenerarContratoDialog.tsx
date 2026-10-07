'use client'

import * as React from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { AppDialog } from '@/components/organisms/AppDialog'
import { DiasCreditoField } from '@/components/molecules/DiasCreditoField'
import {
  generarContratoFormSchema,
  type GenerarContratoFormInput,
  type GenerarContratoFormValues,
} from '@/lib/contratoValidation'
import { fechaCorta } from '@/lib/contratos/textos'
import { sumarDias } from '@/lib/cartera/estado'
import type { TipoContrato } from '@/types/domain'

/** Documento desde el que se genera un contrato (factura o compra a crédito). */
export interface OrigenContratoUI {
  tipo: TipoContrato
  id: string
  /** Fecha del documento (`YYYY-MM-DD`): base del vencimiento del contrato. */
  fecha: string
  /** Días de crédito de la factura (precarga). En compras, `undefined`: el campo arranca vacío. */
  dias_credito_factura?: number
  /** Subtítulo: «Factura F-000123 · Restaurante El Muelle» o «Compra del 07/10/2026 · Pesquera X». */
  etiqueta: string
}

export interface ResultadoGenerar {
  error: string | null
  fieldErrors?: Record<string, string>
}

export interface GenerarContratoDialogProps {
  /** `null` = cerrado. */
  origen: OrigenContratoUI | null
  onClose: () => void
  /** Genera el contrato; si devuelve error, el diálogo queda abierto con él. */
  onGenerar: (origen: OrigenContratoUI, values: GenerarContratoFormValues) => Promise<ResultadoGenerar>
}

/**
 * "Generar contrato" (06-contratos), `AppDialog xs`: pide los días de crédito
 * del contrato (precargados con los de la factura; vacíos en compras) y notas
 * opcionales. Si los días difieren de la factura, avisa que la cobranza sigue
 * con el vencimiento original: la factura no se modifica.
 */
export function GenerarContratoDialog({ origen, onClose, onGenerar }: GenerarContratoDialogProps) {
  return origen ? (
    <GenerarContratoDialogAbierto key={`${origen.tipo}-${origen.id}`} origen={origen} onClose={onClose} onGenerar={onGenerar} />
  ) : null
}

function GenerarContratoDialogAbierto({
  origen,
  onClose,
  onGenerar,
}: GenerarContratoDialogProps & { origen: OrigenContratoUI }) {
  const [pending, setPending] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const enviando = React.useRef(false)

  const { control, handleSubmit, register, setError, formState } = useForm<
    GenerarContratoFormInput,
    unknown,
    GenerarContratoFormValues
  >({
    resolver: zodResolver(generarContratoFormSchema),
    mode: 'onSubmit',
    defaultValues: { dias_credito: origen.dias_credito_factura ?? null, notas: '' },
    disabled: pending,
  })

  const dias = useWatch({ control, name: 'dias_credito' })
  const diasFactura = origen.dias_credito_factura
  const difiere =
    origen.tipo === 'venta_credito' &&
    diasFactura !== undefined &&
    typeof dias === 'number' &&
    Number.isInteger(dias) &&
    dias >= 0 &&
    dias <= 365 &&
    dias !== diasFactura

  const enviar = async (values: GenerarContratoFormValues) => {
    // Doble clic / doble Enter: un solo envío.
    if (enviando.current) return
    enviando.current = true
    setPending(true)
    setServerError(null)
    try {
      const resultado = await onGenerar(origen, values)
      if (resultado.error) {
        setServerError(resultado.error)
        const errDias = resultado.fieldErrors?.dias_credito
        if (errDias) setError('dias_credito', { type: 'server', message: errDias })
        const errNotas = resultado.fieldErrors?.notas
        if (errNotas) setError('notas', { type: 'server', message: errNotas })
      }
    } finally {
      enviando.current = false
      setPending(false)
    }
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(enviar)(e)
  }

  return (
    <AppDialog
      open
      onClose={onClose}
      size="xs"
      title="Generar contrato"
      subtitle={origen.etiqueta}
      pending={pending}
      dirty={formState.isDirty}
      error={serverError}
      onSubmit={onSubmit}
      primaryAction={
        <Button type="submit" variant="contained" loading={pending}>
          Generar contrato
        </Button>
      }
    >
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Controller
          name="dias_credito"
          control={control}
          render={({ field }) => (
            <DiasCreditoField
              value={field.value}
              onChange={(v) => field.onChange(v)}
              fecha={origen.fecha}
              diasHabituales={null}
              disabled={field.disabled}
              error={!!formState.errors.dias_credito}
              helperText={formState.errors.dias_credito?.message}
            />
          )}
        />

        {difiere && diasFactura !== undefined ? (
          <Alert severity="info">
            El vencimiento de la factura en cobranza no cambia (sigue siendo el{' '}
            {fechaCorta(sumarDias(origen.fecha, diasFactura))}); solo el contrato usará el nuevo.
          </Alert>
        ) : null}

        <TextField
          label="Notas"
          size="small"
          fullWidth
          multiline
          minRows={2}
          {...register('notas')}
          error={!!formState.errors.notas}
          helperText={formState.errors.notas?.message ?? 'Opcional. Salen en el PDF.'}
        />
      </Box>
    </AppDialog>
  )
}
