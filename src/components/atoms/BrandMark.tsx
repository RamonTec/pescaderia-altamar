'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * Marca de Altamar Sea Food.
 *
 * PROVISIONAL: el repo todavía no tiene el logo real. Este isotipo (proa de
 * peñero con las franjas de la borda) se dibuja en SVG con los tokens
 * `palette.brand.*`. Cuando llegue el archivo del logo se reemplaza solo
 * aquí, manteniendo la interfaz (`variant`, `size`, `orientation`).
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

const NAME = 'Altamar Sea Food'

function Isotipo({ size, title }: { size: number; title?: string }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 64 40"
      width={size}
      height={(size * 40) / 64}
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
      <path className="bm-hull" d="M2 10 L9 14 H61 L52 34 Q50 37 46 37 H16 Q12 37 10 34 Z" />
      <polygon className="bm-ochre" points="9,14 61,14 59.4,18 10.2,18" />
      <polygon className="bm-trim" points="10.2,18 59.4,18 58.8,19.6 10.7,19.6" />
      <polygon className="bm-red" points="10.7,19.6 58.8,19.6 57.2,23.6 11.9,23.6" />
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
