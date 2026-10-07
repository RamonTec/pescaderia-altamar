'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { formatKg } from '@/lib/format'

export interface LoteChipProps {
  /** Código del lote (`SALM-261005-1`). */
  codigo: string
  /** Kg asignados o en stock; sin valor, solo el código. */
  pesoKg?: number | null
  /** Marca el lote como "antiguo" (supera `dias_alerta_lote`). */
  antiguo?: boolean
  /** Días en cava, para el tooltip del chip "antiguo". */
  dias?: number | null
  /** Prefijo "Lote" delante del código (en líneas de venta). */
  conPrefijo?: boolean
  /** Si se pasa, el chip es clicable (ej. abrir la ficha del lote). */
  onClick?: () => void
  /** Enlace a la ficha del lote (`/inventario/lotes/[id]`). */
  href?: string
  size?: 'small' | 'medium'
}

/**
 * Etiqueta de cava de un lote (07-lotes): código + kg, y un chip "antiguo"
 * cuando el lote superó los días de alerta. Chip `soft` de 22 px (radio 4).
 */
export function LoteChip({
  codigo,
  pesoKg,
  antiguo = false,
  dias,
  conPrefijo = false,
  onClick,
  href,
  size = 'small',
}: LoteChipProps) {
  const texto = `${conPrefijo ? 'Lote ' : ''}${codigo}${pesoKg != null ? ` · ${formatKg(pesoKg)}` : ''}`
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, maxWidth: '100%' }}>
      {href ? (
        <Chip
          component={Link}
          href={href}
          clickable
          size={size}
          variant="soft"
          icon={<Inventory2OutlinedIcon />}
          label={texto}
          sx={{ fontVariantNumeric: 'tabular-nums', maxWidth: '100%' }}
        />
      ) : (
        <Chip
          size={size}
          variant="soft"
          icon={<Inventory2OutlinedIcon />}
          label={texto}
          onClick={onClick}
          sx={{ fontVariantNumeric: 'tabular-nums', maxWidth: '100%' }}
        />
      )}
      {antiguo ? (
        <Tooltip title={dias != null ? `${dias} días en cava` : 'Supera los días de alerta'}>
          <Chip size="small" variant="soft" color="warning" label="Antiguo" />
        </Tooltip>
      ) : null}
    </Box>
  )
}
