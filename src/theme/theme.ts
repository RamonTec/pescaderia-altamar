'use client'

import { createTheme } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'

/**
 * Identidad "Peñero" (Altamar Sea Food): casco azul petróleo, franjas de
 * borda ocre y roja, neutros fríos de hielo y acero. Ver
 * specs/00-estandares-ui/spec.md § Identidad visual.
 *
 * `brand` es un token propio: colores de identidad que no son roles
 * semánticos de MUI (franjas, panel de casco). El ocre nunca se usa para
 * texto (contraste insuficiente sobre claro).
 */
declare module '@mui/material/styles' {
  interface Palette {
    brand: BrandPalette
  }
  interface PaletteOptions {
    brand?: BrandPalette
  }
}

interface BrandPalette {
  /** Fondo del panel de identidad (casco del peñero) */
  hull: string
  /** Franja inferior, casco bajo la línea de agua */
  hullDeep: string
  /** Texto sobre `hull` */
  onHull: string
  /** Texto secundario sobre `hull` */
  onHullMuted: string
  /** Franja ocre de la borda — solo decorativo, nunca texto */
  ochre: string
  /** Franja roja de la borda */
  red: string
  /** Filete claro entre franjas */
  trim: string
}

const DISPLAY_FONT = 'var(--font-display), "Arial Narrow", sans-serif'

/**
 * Theme con CSS variables y dos color schemes (light/dark).
 * `colorSchemeSelector` es un atributo data-* (no 'media') para que el
 * `setMode` de `useColorScheme` pueda alternar manualmente el esquema.
 * El atributo coincide con el default de `InitColorSchemeScript`
 * (`data-mui-color-scheme`).
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#0E4A5C', contrastText: '#FFFFFF' },
        secondary: { main: '#B8402E', contrastText: '#FFFFFF' },
        success: { main: '#2F7D6A' },
        warning: { main: '#B86E00' },
        error: { main: '#C0282D' },
        background: { default: '#F3F6F6', paper: '#FFFFFF' },
        text: { primary: '#13262C', secondary: '#4A5D63' },
        divider: 'rgba(19, 38, 44, 0.14)',
        brand: {
          hull: '#0E4A5C',
          hullDeep: '#0A3644',
          onHull: '#EAF2F3',
          onHullMuted: '#A9C6CD',
          ochre: '#E8B931',
          red: '#B8402E',
          trim: '#EAF2F3',
        },
      },
    },
    dark: {
      palette: {
        primary: { main: '#7CC3D6', contrastText: '#0A2730' },
        secondary: { main: '#E58A74', contrastText: '#2A0E08' },
        success: { main: '#6CC2A9' },
        warning: { main: '#F0C75A' },
        error: { main: '#F08A84' },
        background: { default: '#0F2229', paper: '#15303A' },
        text: { primary: '#E4EDEF', secondary: '#9DB3B9' },
        divider: 'rgba(228, 237, 239, 0.14)',
        brand: {
          hull: '#123F4E',
          hullDeep: '#0A2A35',
          onHull: '#EAF2F3',
          onHullMuted: '#9DBFC7',
          ochre: '#D9A92A',
          red: '#B8402E',
          trim: '#C9D8DB',
        },
      },
    },
  },
  typography: {
    fontFamily: 'var(--font-body), system-ui, sans-serif',
    h1: { fontFamily: DISPLAY_FONT, fontWeight: 600 },
    h2: { fontFamily: DISPLAY_FONT, fontWeight: 600 },
    h3: { fontFamily: DISPLAY_FONT, fontWeight: 600, lineHeight: 1.05 },
    h4: { fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: '2.125rem', lineHeight: 1.1 },
    h5: { fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: '1.625rem', lineHeight: 1.15 },
    h6: { fontFamily: DISPLAY_FONT, fontWeight: 600, fontSize: '1.3rem', lineHeight: 1.2 },
    button: { fontWeight: 500, textTransform: 'none', letterSpacing: 0 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiOutlinedInput: {
      // Campo blanco sobre el fondo "hielo" para que se lea como superficie editable.
      styleOverrides: { root: { backgroundColor: 'var(--mui-palette-background-paper)' } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 12 } },
    },
    // Chips como etiquetas de cava (rectas), no píldoras.
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, fontWeight: 500 },
        sizeSmall: { height: 22 },
      },
    },
    // Encabezados de tabla sobre "hielo"; mismo tratamiento en Table y DataGrid.
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.default,
          color: theme.vars.palette.text.secondary,
          fontWeight: 600,
        }),
        root: { fontVariantNumeric: 'tabular-nums' },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.paper,
          borderColor: theme.vars.palette.divider,
          fontVariantNumeric: 'tabular-nums',
          '--DataGrid-containerBackground': theme.vars.palette.background.default,
        }),
        columnHeaderTitle: ({ theme }) => ({
          fontWeight: 600,
          color: theme.vars.palette.text.secondary,
        }),
        columnSeparator: { display: 'none' },
      },
    },
  },
})
