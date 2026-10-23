'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { NOMBRE_MARCA } from '@/theme/marca'
import {
  ISOTIPO_ALTO,
  ISOTIPO_ANCHO,
  ISOTIPO_CASCO,
  ISOTIPO_FRANJAS,
  ISOTIPO_VIEWBOX,
} from '@/lib/marca/isotipo'

/**
 * Marca de Altamar Sea Food.
 *
 * PROVISIONAL: el repo todavía no tiene el logo real. Este isotipo (proa de
 * peñero con las franjas de la borda) se dibuja en SVG con los tokens
 * `palette.brand.*`. Cuando llegue el archivo del logo se reemplaza solo
 * aquí y en `src/lib/marca/isotipo.ts` (geometría compartida con el PDF),
 * manteniendo la interfaz (`variant`, `size`, `orientation`).
 * El ícono de la app (`src/app/icon.svg`) es una copia estática de este
 * mismo dibujo y se regenera junto con él.
 */
export interface BrandMarkProps {
  /** `full`: isotipo + nombre. `isotipo`: solo el dibujo. */
  variant?: 'full' | 'isotipo'
  /** Ancho del isotipo en px (el alto guarda la proporción 64:40). */
  size?: number
  /** Solo para `full`: nombre al lado (menú) o debajo (loader). */
  orientation?: 'horizontal' | 'vertical'
  /** Etiqueta accesible del isotipo cuando va solo. Si se omite, es decorativo. */
  title?: string
}

const NAME = NOMBRE_MARCA

function Isotipo({ size, title }: { size: number; title?: string }) {
  return (
    <Box
      component="svg"
      viewBox={ISOTIPO_VIEWBOX}
      width={size}
      height={(size * ISOTIPO_ALTO) / ISOTIPO_ANCHO}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      sx={(theme) => {
        const brand = (theme.vars ?? theme).palette.brand
        return {
          flexShrink: 0,
          display: 'block',
          '& .bm-hull': { fill: brand.hull },
          '& .bm-ochre': { fill: brand.ochre },
          '& .bm-trim': { fill: brand.trim },
          '& .bm-red': { fill: brand.red },
        }
      }}
    >
      <path className="bm-hull" d={ISOTIPO_CASCO} />
      <polygon className="bm-ochre" points={ISOTIPO_FRANJAS.ochre} />
      <polygon className="bm-trim" points={ISOTIPO_FRANJAS.trim} />
      <polygon className="bm-red" points={ISOTIPO_FRANJAS.red} />
    </Box>
  )
}

export function BrandMark({
  variant = 'full',
  size = 40,
  orientation = 'horizontal',
  title,
}: BrandMarkProps) {
  if (variant === 'isotipo') {
    return <Isotipo size={size} title={title ?? NAME} />
  }

  const vertical = orientation === 'vertical'
  return (
    <Box
      sx={{
        display: 'inline-flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        gap: 1.25,
        minWidth: 0,
      }}
    >
      <Isotipo size={size} />
      <Typography variant={vertical ? 'h5' : 'h6'} component="span" noWrap>
        {NAME}
      </Typography>
    </Box>
  )
}
