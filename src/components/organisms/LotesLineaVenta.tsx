'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { LoteChip } from '@/components/molecules/LoteChip'
import { AsignacionLotesPanel } from '@/components/organisms/AsignacionLotesPanel'
import { formatKg } from '@/lib/format'
import type { AsignacionLote, Lote, SugerenciaLotes } from '@/types/domain'
import {
  lotesAbiertosAction,
  sugerirLotesAction,
} from '@/app/(protected)/inventario/actions'

const DEBOUNCE_MS = 300

export interface LotesLineaVentaProps {
  productoId: string | null | undefined
  pesoKg: number | null | undefined
  /** `false`: el producto no usa lotes y no se muestra nada. */
  controlaStock: boolean
  /** Asignación elegida a mano; `undefined` = PEPS automático. */
  asignaciones: AsignacionLote[] | undefined
  onAsignacionesChange: (asignaciones: AsignacionLote[] | undefined) => void
  /** Error de la línea (zod o servidor: stock insuficiente, no cuadra…). */
  error?: string
  disabled?: boolean
  /** Avisa si la línea tiene stock suficiente en lotes (para bloquear la emisión). */
  onSuficiencia?: (suficiente: boolean) => void
}

/**
 * Lotes de una línea de venta (POS y entrega de pedido, 07-lotes). Al tener
 * producto y peso pide la propuesta PEPS (`sugerir_lotes`, debounce de 300 ms,
 * `Skeleton` pequeño mientras llega) y la muestra como chips. "Cambiar
 * lotes" abre, en la misma línea, la edición de la asignación; "Volver a
 * PEPS" la descarta. Sin stock suficiente, la línea muestra el error y avisa
 * con `onSuficiencia(false)`.
 */
export function LotesLineaVenta({
  productoId,
  pesoKg,
  controlaStock,
  asignaciones,
  onAsignacionesChange,
  error,
  disabled,
  onSuficiencia,
}: LotesLineaVentaProps) {
  const peso = pesoKg != null && pesoKg > 0 ? Math.round(pesoKg * 1000) / 1000 : null
  const clave = controlaStock && productoId && peso != null ? `${productoId}:${peso}` : null

  const [sugerencia, setSugerencia] = React.useState<{
    clave: string
    data: SugerenciaLotes | null
    error: string | null
  } | null>(null)
  const [editando, setEditando] = React.useState(false)
  const [lotes, setLotes] = React.useState<{ productoId: string; data: Lote[] | null; error: string | null } | null>(
    null
  )

  // Propuesta PEPS con debounce; respuestas viejas se ignoran por clave.
  React.useEffect(() => {
    if (!clave || !productoId || peso == null) return
    let vigente = true
    const t = window.setTimeout(async () => {
      const r = await sugerirLotesAction(productoId, peso)
      if (vigente) setSugerencia({ clave, data: r.data, error: r.error })
    }, DEBOUNCE_MS)
    return () => {
      vigente = false
      window.clearTimeout(t)
    }
  }, [clave, productoId, peso])

  const actual = sugerencia?.clave === clave ? sugerencia : null
  const cargando = clave != null && actual == null
  const manual = asignaciones && asignaciones.length > 0 ? asignaciones : null
  const propuesta = actual?.data?.asignacion ?? []
  const insuficiente = !manual && actual?.data != null && !actual.data.suficiente

  React.useEffect(() => {
    if (!onSuficiencia) return
    onSuficiencia(!insuficiente)
  }, [insuficiente, onSuficiencia])

  if (!controlaStock || !productoId) return null
  if (peso == null) {
    return error ? (
      <Typography variant="caption" color="error">
        {error}
      </Typography>
    ) : null
  }

  const abrirEdicion = async () => {
    setEditando(true)
    if (lotes?.productoId === productoId && lotes.data) return
    setLotes({ productoId, data: null, error: null })
    const r = await lotesAbiertosAction(productoId)
    setLotes({ productoId, data: r.error ? null : r.data, error: r.error })
  }

  const mostradas = manual ?? propuesta

  return (
    <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
        {cargando ? (
          <Skeleton variant="rounded" width={180} height={24} aria-label="Buscando lotes" />
        ) : (
          mostradas.map((a) => (
            <LoteChip key={a.lote_id} codigo={a.codigo} pesoKg={a.peso_kg} conPrefijo />
          ))
        )}
        {!cargando && !editando ? (
          <Typography variant="caption" color="text.secondary">
            {manual ? 'Elegidos a mano' : mostradas.length > 0 ? 'Propuesto PEPS' : null}
          </Typography>
        ) : null}
        <Box sx={{ flex: 1 }} />
        {!editando && !cargando ? (
          <>
            {manual ? (
              <Button size="small" disabled={disabled} onClick={() => onAsignacionesChange(undefined)}>
                Volver a PEPS
              </Button>
            ) : null}
            <Button size="small" disabled={disabled} onClick={abrirEdicion}>
              Cambiar lotes
            </Button>
          </>
        ) : null}
      </Box>

      {insuficiente && actual?.data ? (
        <Typography variant="caption" color="error" role="alert">
          Stock insuficiente: hay {formatKg(actual.data.disponible_kg ?? 0)} en lotes y faltan{' '}
          {formatKg(actual.data.faltante_kg)}. No se puede emitir esta venta.
        </Typography>
      ) : null}
      {actual?.error ? (
        <Typography variant="caption" color="error">
          {actual.error}
        </Typography>
      ) : null}
      {error ? (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      ) : null}

      <Collapse in={editando} unmountOnExit>
        <AsignacionLotesPanel
          key={`${productoId}:${peso}`}
          lotes={lotes?.productoId === productoId ? lotes.data : null}
          error={lotes?.productoId === productoId ? lotes.error : null}
          pesoKg={peso}
          inicial={mostradas}
          onCancelar={() => setEditando(false)}
          onAplicar={(a) => {
            onAsignacionesChange(a)
            setEditando(false)
          }}
        />
      </Collapse>
    </Box>
  )
}
