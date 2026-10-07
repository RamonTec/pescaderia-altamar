'use client'

import * as React from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { diasEnCava, esAntiguo } from '@/lib/lotes'
import { formatFecha, formatKg } from '@/lib/format'
import type { Lote } from '@/types/domain'

export interface LoteAutocompleteProps {
  /** Lotes abiertos con stock, en orden PEPS (el más antiguo primero). */
  lotes: Lote[]
  /** Id del lote elegido. */
  value: string | null
  onChange: (lote: Lote | null) => void
  onBlur?: () => void
  /** `config_negocio.dias_alerta_lote`: marca "antiguo" a los que lo superan. */
  diasAlertaLote: number | null
  label?: string
  error?: boolean
  helperText?: React.ReactNode
  disabled?: boolean
  /** Texto si no hay lotes con stock. */
  noOptionsText?: string
}

function etiqueta(l: Lote): string {
  return `${l.codigo} · ${formatKg(l.stock_kg)}`
}

/**
 * Selector de lote (07-lotes): cada opción muestra código, fecha de ingreso,
 * días en cava, proveedor y kg disponibles, con chip "antiguo". El padre
 * preselecciona el más antiguo (primero de `lotes`, que llegan en PEPS).
 */
export function LoteAutocomplete({
  lotes,
  value,
  onChange,
  onBlur,
  diasAlertaLote,
  label = 'Lote *',
  error,
  helperText,
  disabled,
  noOptionsText = 'Sin lotes con stock',
}: LoteAutocompleteProps) {
  const seleccionado = lotes.find((l) => l.id === value) ?? null
  const config = { dias_alerta_lote: diasAlertaLote }

  return (
    <Autocomplete
      options={lotes}
      value={seleccionado}
      onChange={(_, next) => onChange(next)}
      onBlur={onBlur}
      disabled={disabled}
      getOptionLabel={etiqueta}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText={noOptionsText}
      renderOption={({ key, ...props }, l) => {
        const dias = diasEnCava(l)
        return (
          <Box component="li" key={key} {...props} sx={{ gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {l.codigo}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" noWrap>
                {formatFecha(l.fecha_ingreso)} · {dias} {dias === 1 ? 'día' : 'días'}
                {l.proveedor_nombre ? ` · ${l.proveedor_nombre}` : ''}
              </Typography>
            </Box>
            {esAntiguo(l, config) ? (
              <Chip size="small" variant="soft" color="warning" label="Antiguo" />
            ) : null}
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {formatKg(l.stock_kg)}
            </Typography>
          </Box>
        )
      }}
      renderInput={(params) => (
        <TextField {...params} label={label} error={error} helperText={helperText} />
      )}
    />
  )
}
