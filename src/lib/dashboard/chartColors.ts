import type { Theme } from '@mui/material/styles'

/**
 * Colores de las gráficas del dashboard (15, D1 `@mui/x-charts`), solo desde
 * `theme.palette` (spec § Gráficas): nunca hex ni `brand.ochre` (decorativo).
 *
 * Devuelve las variables CSS del theme (`var(--mui-palette-…)`): el theme usa
 * `cssVariables`, así que el mismo valor sirve en claro y oscuro sin volver a
 * renderizar ni desajustar la hidratación. `@mui/x-charts` usa el color tal
 * cual en `fill`/`stroke` y en la marca del tooltip (no lo manipula).
 *
 * Puro: recibe el theme (quien llama hace `useTheme()`); sin React.
 */
export interface ColoresGrafico {
  /** Montos USD (ventas, saldos). */
  usd: string
  /** Kilos. */
  kg: string
  /** Costo. */
  costo: string
  /** Margen, cobros, positivo. */
  positivo: string
  /** Pagos, vencido, negativo. */
  negativo: string
  /** Advertencia (por vencer, tramo intermedio). */
  advertencia: string
  /** Informativo / neutro de apoyo. */
  info: string
  /** Neutro (resto, referencia). */
  neutro: string
  /** Serie categórica en orden (motivos, métodos, tramos). */
  categorias: readonly string[]
}

export function coloresGrafico(theme: Theme): ColoresGrafico {
  const p = (theme.vars ?? theme).palette
  return {
    usd: p.primary.main,
    kg: p.info.main,
    costo: p.warning.main,
    positivo: p.success.main,
    negativo: p.error.main,
    advertencia: p.warning.main,
    info: p.info.main,
    neutro: p.text.secondary,
    categorias: [
      p.primary.main,
      p.info.main,
      p.success.main,
      p.warning.main,
      p.secondary.main,
      p.error.main,
    ],
  }
}
