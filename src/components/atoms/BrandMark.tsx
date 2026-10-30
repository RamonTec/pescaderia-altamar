'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { NOMBRE_MARCA } from '@/theme/marca'
import {
  ISOTIPO_ALTO,
  ISOTIPO_ANCHO,
  ISOTIPO_CASCO,
  ISOTIPO_FILETE,
  ISOTIPO_VIEWBOX,
} from '@/lib/marca/isotipo'

/**
 * Marca de Altamar Sea Food.
 *
 * PROVISIONAL: el repo todavía no tiene el logo real. Este isotipo (P-UI4:
 * proa en `brand.midnight`, o `brand.onMidnight` sobre medianoche, con un
 * filete de `brand.brass`) se dibuja en SVG con los tokens `palette.brand.*`. Cuando llegue el archivo del logo se reemplaza solo
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
  /** Sobre fondo medianoche (sidebar, panel de auth): proa y nombre claros. */
  sobreMedianoche?: boolean
}

/** Nombre corto de la variante `full` (P-UI4). */
const NOMBRE_CORTO = 'Altamar'

function Isotipo({
  size,
  title,
  sobreMedianoche,
}: {
  size: number
  title?: string
  sobreMedianoche?: boolean
}) {
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
          '& .bm-proa': { fill: sobreMedianoche ? brand.onMidnight : brand.midnight },
          '& .bm-filete': { fill: brand.brass },
        }
      }}
    >
      <path className="bm-proa" d={ISOTIPO_CASCO} />
      <polygon className="bm-filete" points={ISOTIPO_FILETE} />
    </Box>
  )
}

export function BrandMark({
  variant = 'full',
  size = 40,
  orientation = 'horizontal',
  title,
  sobreMedianoche = false,
}: BrandMarkProps) {
  if (variant === 'isotipo') {
    return <Isotipo size={size} title={title ?? NOMBRE_MARCA} sobreMedianoche={sobreMedianoche} />
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
      <Isotipo size={size} sobreMedianoche={sobreMedianoche} />
      <Typography
        component="span"
        noWrap
        sx={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontWeight: 600,
          fontSize: vertical ? '1.5rem' : '1.25rem',
          lineHeight: 1.2,
          color: sobreMedianoche ? 'brand.onMidnight' : 'text.primary',
        }}
      >
        {NOMBRE_CORTO}
      </Typography>
    </Box>
  )
}
