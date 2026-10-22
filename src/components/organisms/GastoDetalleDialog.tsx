'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { AppDialog } from '@/components/organisms/AppDialog'
import { EstadoChip, type EstadoDef } from '@/components/organisms/appDataGridColumns'
import { formatBs, formatFecha, formatFechaHora, formatTasa, formatUsd } from '@/lib/format'
import { ETIQUETA_METODO } from '@/lib/dashboard/etiquetas'
import { ETIQUETA_ESTADO_GASTO, textoTasaGasto } from '@/lib/gastos/textos'
import { detalleGastoAction } from '@/app/(protected)/gastos/actions'
import type { EstadoGasto, GastoDetalle } from '@/types/domain'

export const COLOR_ESTADO_GASTO: Record<EstadoGasto, EstadoDef['color']> = {
  pendiente: 'warning',
  confirmado: 'success',
  descartado: 'default',
  anulado: 'error',
}

export interface GastoDetalleDialogProps {
  /** Gasto a mostrar; `null` = cerrado. */
  gastoId: string | null
  onClose: () => void
}

/**
 * Datos completos y trazabilidad de un gasto (20-gastos): creado, confirmado,
 * última edición, anulado o descartado (quién, cuándo y motivo) y la tasa con
 * su procedencia. Lee el detalle por Server Action al abrir (solo lectura).
 */
export function GastoDetalleDialog({ gastoId, onClose }: GastoDetalleDialogProps) {
  // Resultado por id: "cargando" se deriva (sin setState síncrono en el efecto).
  const [resultado, setResultado] = React.useState<{
    id: string
    detalle: GastoDetalle | null
    error: string | null
  } | null>(null)

  React.useEffect(() => {
    if (!gastoId) return
    let vigente = true
    detalleGastoAction(gastoId)
      .then((r) => {
        if (!vigente) return
        setResultado({
          id: gastoId,
          detalle: r.detalle ?? null,
          error: r.error || !r.detalle ? (r.error ?? 'No se pudo cargar el gasto') : null,
        })
      })
      .catch(() => {
        if (vigente) setResultado({ id: gastoId, detalle: null, error: 'No se pudo cargar el gasto' })
      })
    return () => {
      vigente = false
    }
  }, [gastoId])

  const actual = resultado && resultado.id === gastoId ? resultado : null
  const cargando = !!gastoId && !actual
  const detalle = actual?.detalle ?? null
  const error = actual?.error ?? null

  const d = detalle
  const categoria = d
    ? d.categoria_padre_nombre
      ? `${d.categoria_padre_nombre} › ${d.categoria_nombre ?? '—'}`
      : (d.categoria_nombre ?? '—')
    : ''

  return (
    <AppDialog
      open={!!gastoId}
      onClose={onClose}
      size="sm"
      title="Detalle del gasto"
      subtitle={d ? `${formatFecha(d.fecha)} · ${d.descripcion}` : undefined}
      cancelLabel="Cerrar"
      error={error}
      autoFocusFirstField={false}
    >
      {cargando ? (
        <Box sx={{ display: 'grid', gap: 1 }} aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="text" height={28} />
          ))}
        </Box>
      ) : d ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <EstadoChip label={ETIQUETA_ESTADO_GASTO[d.estado]} color={COLOR_ESTADO_GASTO[d.estado]} />
          </Box>
          <Grid2>
            <Dato label="Fecha" value={formatFecha(d.fecha)} />
            <Dato label="Categoría" value={categoria} />
            <Dato label="Descripción" value={d.descripcion} />
            {d.empleado_id ? <Dato label="Empleado" value={d.empleado_nombre ?? '—'} /> : null}
            <Dato label="Beneficiario" value={d.beneficiario ?? '—'} />
            <Dato label="Monto" value={d.moneda === 'bs' ? formatBs(d.monto) : formatUsd(d.monto)} numerico />
            <Dato label="Monto USD" value={d.monto_usd !== null ? formatUsd(d.monto_usd) : '—'} numerico />
            <Dato label="Tasa" value={textoTasaGasto(d)} numerico />
            <Dato
              label="Referencial"
              value={d.tasa_referencial !== null ? formatTasa(d.tasa_referencial) : '—'}
              numerico
            />
            {d.moneda === 'usd' && d.tasa_snapshot !== null ? (
              <Dato label="Equivalente Bs" value={formatBs(d.monto * d.tasa_snapshot)} numerico />
            ) : null}
            <Dato label="Método" value={d.metodo_pago ? ETIQUETA_METODO[d.metodo_pago] : '—'} />
            <Dato label="Referencia" value={d.referencia ?? '—'} />
            {d.periodo_desde ? (
              <Dato label="Período" value={`${formatFecha(d.periodo_desde)} – ${formatFecha(d.periodo_hasta)}`} />
            ) : null}
          </Grid2>
          {d.notas ? <Dato label="Notas" value={d.notas} /> : null}

          <Divider />
          <Typography variant="subtitle2" component="h3">
            Trazabilidad
          </Typography>
          <Grid2>
            <Dato label="Registrado" value={`${d.creado_por_nombre ?? '—'} · ${formatFechaHora(d.created_at)}`} />
            {d.confirmado_at ? (
              <Dato
                label="Confirmado"
                value={`${d.confirmado_por_nombre ?? '—'} · ${formatFechaHora(d.confirmado_at)}`}
              />
            ) : null}
            {d.updated_by ? (
              <Dato
                label="Última edición"
                value={`${d.actualizado_por_nombre ?? '—'} · ${formatFechaHora(d.updated_at)}`}
              />
            ) : null}
            {d.anulado_at ? (
              <Dato
                label={d.estado === 'descartado' ? 'Descartado' : 'Anulado'}
                value={`${d.anulado_por_nombre ?? '—'} · ${formatFechaHora(d.anulado_at)}`}
              />
            ) : null}
          </Grid2>
          {d.motivo_anulacion ? <Dato label="Motivo" value={d.motivo_anulacion} /> : null}
        </Box>
      ) : null}
    </AppDialog>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>{children}</Box>
  )
}

function Dato({ label, value, numerico = false }: { label: string; value: string; numerico?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ overflowWrap: 'anywhere', ...(numerico ? { fontVariantNumeric: 'tabular-nums' } : {}) }}
      >
        {value}
      </Typography>
    </Box>
  )
}
