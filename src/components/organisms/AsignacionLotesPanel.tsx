'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { NumberField } from '@/components/atoms/NumberField'
import { diasEnCava } from '@/lib/lotes'
import { formatFecha, formatKg } from '@/lib/format'
import { sumaAsignacion, TOLERANCIA_KG } from '@/lib/loteValidation'
import type { AsignacionLote, Lote } from '@/types/domain'

export interface AsignacionLotesPanelProps {
  /** Lotes abiertos con stock del producto (PEPS); `null` mientras cargan. */
  lotes: Lote[] | null
  /** Peso de la línea: la asignación debe sumarlo. */
  pesoKg: number
  /** Asignación de partida (la actual o la propuesta PEPS). */
  inicial: AsignacionLote[]
  error?: string | null
  onAplicar: (asignaciones: AsignacionLote[]) => void
  onCancelar: () => void
}

const kgDe = (mapa: Record<string, number | null>, id: string) => mapa[id] ?? 0

/**
 * Edición de la asignación de lotes de una línea de venta (07-lotes): kg por
 * lote abierto, con aviso en vivo si el total no cuadra con el peso o si un
 * lote no alcanza. Va en línea (dentro de la línea del POS o de la entrega),
 * no en un diálogo aparte: el estándar de modales no permite abrir un
 * diálogo de formulario desde otro (`00-estandares-ui`, "Modales").
 */
export function AsignacionLotesPanel({
  lotes,
  pesoKg,
  inicial,
  error,
  onAplicar,
  onCancelar,
}: AsignacionLotesPanelProps) {
  const [kg, setKg] = React.useState<Record<string, number | null>>(() =>
    Object.fromEntries(inicial.map((a) => [a.lote_id, a.peso_kg]))
  )

  if (error) return <Alert severity="error">{error}</Alert>
  if (!lotes) {
    return (
      <Box sx={{ display: 'grid', gap: 1 }} aria-busy="true">
        <Skeleton variant="rounded" height={40} />
        <Skeleton variant="rounded" height={40} />
      </Box>
    )
  }

  const asignaciones: AsignacionLote[] = lotes
    .filter((l) => kgDe(kg, l.id) > 0)
    .map((l) => ({
      lote_id: l.id,
      codigo: l.codigo,
      peso_kg: kgDe(kg, l.id),
      disponible_kg: l.stock_kg,
      fecha_ingreso: l.fecha_ingreso,
    }))
  const total = sumaAsignacion(asignaciones)
  const cuadra = Math.abs(total - pesoKg) <= TOLERANCIA_KG
  const excedido = asignaciones.find((a) => a.peso_kg > a.disponible_kg + TOLERANCIA_KG)
  const valido = cuadra && !excedido && asignaciones.length > 0

  const repartirPeps = () => {
    let resto = pesoKg
    const siguiente: Record<string, number | null> = {}
    for (const l of lotes) {
      const toma = Math.max(0, Math.min(resto, l.stock_kg))
      siguiente[l.id] = toma > 0 ? Math.round(toma * 1000) / 1000 : null
      resto -= toma
    }
    setKg(siguiente)
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      {lotes.length === 0 ? (
        <Alert severity="warning">No hay lotes abiertos con stock de este producto.</Alert>
      ) : (
        lotes.map((l) => {
          const dias = diasEnCava(l)
          const valor = kg[l.id] ?? null
          const excede = (valor ?? 0) > l.stock_kg + TOLERANCIA_KG
          return (
            <Box
              key={l.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 160px' },
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {l.codigo}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFecha(l.fecha_ingreso)} · {dias} {dias === 1 ? 'día' : 'días'} · disponible{' '}
                  {formatKg(l.stock_kg)}
                </Typography>
              </Box>
              <NumberField
                label="Kg de este lote"
                size="small"
                decimals={3}
                suffix="kg"
                value={valor}
                onChange={(v) => setKg((prev) => ({ ...prev, [l.id]: v }))}
                error={excede}
                helperText={excede ? 'Supera lo disponible' : undefined}
              />
            </Box>
          )
        })
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="body2"
          color={cuadra ? 'text.secondary' : 'error'}
          sx={{ flex: 1, fontVariantNumeric: 'tabular-nums' }}
          role="status"
          aria-live="polite"
        >
          Asignado {formatKg(total)} de {formatKg(pesoKg)}
          {!cuadra ? ' · no cuadra con el peso' : ''}
          {excedido ? ` · ${excedido.codigo} no alcanza` : ''}
        </Typography>
        <Button size="small" onClick={repartirPeps} disabled={lotes.length === 0}>
          Repartir PEPS
        </Button>
        <Button size="small" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button size="small" variant="outlined" disabled={!valido} onClick={() => onAplicar(asignaciones)}>
          Aplicar lotes
        </Button>
      </Box>
    </Box>
  )
}
