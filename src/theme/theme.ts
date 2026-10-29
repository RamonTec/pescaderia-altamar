'use client'

import { createTheme, type Theme } from '@mui/material/styles'
import { esES as materialEsES } from '@mui/material/locale'
import { esES as dataGridEsES } from '@mui/x-data-grid/locales'
import type {} from '@mui/x-data-grid/themeAugmentation'
import { MARCA_CLARO, MARCA_OSCURO } from './marca'

/**
 * Identidad "Puerto" (Altamar Sea Food): azul medianoche (#0B1B33), blanco
 * marfil (#F7F6F2), detalles en latón (#C9A66B / #D4B27A), títulos Fraunces,
 * datos Instrument Sans. Ver specs/00-estandares-ui/spec.md § Identidad visual «Puerto».
 *
 * `brand` es un token propio: colores de identidad que no son roles
 * semánticos de MUI (filete, sidebar, fondos de marca).
 */
declare module '@mui/material/styles' {
  interface TypeBackground {
    subtle: string
  }
  interface PaletteColor {
    soft?: string
    onSoft?: string
  }
  interface SimplePaletteColorOptions {
    soft?: string
    onSoft?: string
  }
  interface Palette {
    brand: BrandPalette
    chart: {
      c1: string
      c2: string
      c3: string
      c4: string
      c5: string
      c6: string
    }
    inputBorder: string
  }
  interface PaletteOptions {
    brand?: BrandPalette
    chart?: {
      c1: string
      c2: string
      c3: string
      c4: string
      c5: string
      c6: string
    }
    inputBorder?: string
  }
}

interface BrandPalette {
  /** Casco (Peñero, compat). */
  hull: string
  hullDeep: string
  onHull: string
  onHullMuted: string
  ochre: string
  red: string
  trim: string

  /** Identidad Puerto */
  midnight: string
  navy: string
  onMidnight: string
  onMidnightMuted: string
  brass: string
  brassText: string
}

declare module '@mui/material/Chip' {
  interface ChipPropsVariantOverrides {
    soft: true
  }
}

declare module '@mui/material/SvgIcon' {
  interface SvgIconPropsSizeOverrides {
    xlarge: true
  }
}

const SOFT_COLORS = ['primary', 'secondary', 'success', 'warning', 'error', 'info'] as const

const DISPLAY_FONT = 'var(--font-display), Georgia, serif'

/**
 * Theme con CSS variables y dos color schemes (light/dark).
 * `colorSchemeSelector` es un atributo data-* (no 'media') para que el
 * `setMode` de `useColorScheme` pueda alternar manualmente el esquema.
 * El atributo coincide con el default de `InitColorSchemeScript`
 * (`data-mui-color-scheme`).
 */
export const theme = createTheme(
{
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#0B1B33', contrastText: '#FFFFFF', soft: '#E6ECF5', onSoft: '#0B1B33' },
        secondary: { main: '#7A5C2E', contrastText: '#FFFFFF', soft: '#F5EEE3', onSoft: '#7A5C2E' },
        success: { main: '#2F5E9E', light: '#ABC7F1', contrastText: '#FFFFFF', soft: '#ABC7F1', onSoft: '#0B1B33' },
        warning: { main: '#A15C07', contrastText: '#FFFFFF', soft: '#F8EEDD', onSoft: '#7E4705' },
        error: { main: '#B3261E', contrastText: '#FFFFFF', soft: '#F8E5E3', onSoft: '#8E1F18' },
        info: { main: '#44597A', contrastText: '#FFFFFF', soft: '#E1E8F2', onSoft: '#26374F' },
        background: { default: '#F7F6F2', paper: '#FFFFFF', subtle: '#F0EEE7' },
        text: { primary: '#0B1B33', secondary: '#5B6474' },
        divider: '#E4E1D8',
        inputBorder: '#A9A397',
        chart: {
          c1: '#0B1B33',
          c2: '#2F5E9E',
          c3: '#7A5C2E',
          c4: '#A15C07',
          c5: '#5B6474',
          c6: '#B3261E',
        },
        // Hex de marca en `src/theme/marca.ts` (los usa también el PDF, 21).
        brand: { ...MARCA_CLARO },
      },
    },
    dark: {
      palette: {
        primary: { main: '#D4B27A', contrastText: '#241A0B', soft: 'rgba(212, 178, 122, 0.16)', onSoft: '#D4B27A' },
        secondary: { main: '#D4B27A', contrastText: '#241A0B', soft: 'rgba(212, 178, 122, 0.16)', onSoft: '#D4B27A' },
        success: { main: '#ABC7F1', contrastText: '#0B1B33', soft: 'rgba(171, 199, 241, 0.16)', onSoft: '#ABC7F1' },
        warning: { main: '#E9B460', contrastText: '#241A0B', soft: 'rgba(233, 180, 96, 0.16)', onSoft: '#E9B460' },
        error: { main: '#EE8A83', contrastText: '#241A0B', soft: 'rgba(238, 138, 131, 0.16)', onSoft: '#EE8A83' },
        info: { main: '#9FB4D3', contrastText: '#0A1424', soft: 'rgba(159, 180, 211, 0.16)', onSoft: '#9FB4D3' },
        background: { default: '#0A1424', paper: '#121F35', subtle: '#17253D' },
        text: { primary: '#EEF0F4', secondary: '#A3ADBD' },
        divider: '#22314B',
        inputBorder: '#2C3B55',
        chart: {
          c1: '#ABC7F1',
          c2: '#D4B27A',
          c3: '#EEF0F4',
          c4: '#E9B460',
          c5: '#A3ADBD',
          c6: '#EE8A83',
        },
        brand: { ...MARCA_OSCURO },
      },
    },
  },
  typography: {
    // Escala de specs/00-estandares-ui/spec.md § Tipografía. No se usan
    // tamaños sueltos: si falta uno, se agrega primero a la spec.
    fontFamily: 'var(--font-body), system-ui, sans-serif',
    h1: { fontFamily: DISPLAY_FONT, fontWeight: 600 },
    h2: { fontFamily: DISPLAY_FONT, fontWeight: 600 },
    h3: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 600,
      fontSize: '3.25rem', // 52px
      lineHeight: 1.05,
      '@media (max-width:599.95px)': { fontSize: '2.625rem' /* 42px */ },
    },
    h4: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 600,
      fontSize: '1.625rem', // 26px
      lineHeight: 1.2,
      '@media (max-width:599.95px)': { fontSize: '1.5rem' /* 24px */ },
    },
    h5: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 500,
      fontSize: '1.5rem', // 24px Fraunces 500 (P-UI5)
      lineHeight: 1.2,
      fontVariantNumeric: 'tabular-nums',
    },
    h6: {
      fontFamily: 'var(--font-body), system-ui, sans-serif',
      fontWeight: 600,
      fontSize: '1.125rem', // 18px Instrument Sans 600
      lineHeight: 1.35,
    },
    subtitle1: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 500 },
    subtitle2: {
      fontSize: '0.75rem', // 12px
      lineHeight: 1.4,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'none',
    },
    body1: { fontSize: '1rem', lineHeight: 1.55 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
    button: { fontSize: '0.875rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0 },
    overline: { textTransform: 'none', letterSpacing: 0 },
  },
  // Radios por jerarquía (spec § Jerarquía de superficies y radios):
  // chip/menú/tooltip 4, botón/input/fab/tabla 6 (`shape`), panel/ficha 8
  // (`MuiPaper.rounded`), diálogo 8 (0 en pantalla completa).
  shape: { borderRadius: 6 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.Mui-focusVisible': {
            outline: `2px solid ${theme.vars.palette.primary.main}`,
            outlineOffset: '2px',
          },
        }),
      },
    },
    MuiFab: {
      styleOverrides: { root: { borderRadius: 6, textTransform: 'none' } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: 'var(--mui-palette-background-paper)',
          borderRadius: 6,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.vars.palette.inputBorder,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.vars.palette.text.secondary,
          },
        }),
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { rounded: { borderRadius: 8 } },
      variants: [
        {
          props: { variant: 'elevation', elevation: 0 },
          style: ({ theme }) => ({ border: `1px solid ${theme.vars.palette.divider}` }),
        },
      ],
    },
    MuiAlert: {
      styleOverrides: { standard: { border: 0 }, filled: { border: 0 } },
    },
    MuiDrawer: {
      styleOverrides: {
        docked: ({ theme }) => ({
          '& .MuiDrawer-paper': {
            border: 0,
            borderRight: `1px solid ${theme.vars.palette.divider}`,
          },
        }),
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: ({ theme }) => ({ border: 0, borderRadius: 6, boxShadow: theme.vars.shadows[8] }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 6 },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { borderRadius: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 8 }, paperFullScreen: { borderRadius: 0 } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { borderRadius: 4 } },
    },
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, fontWeight: 500 },
        sizeSmall: { height: 22 },
      },
      variants: [
        {
          props: { variant: 'soft' },
          style: ({ theme }) => ({
            backgroundColor: theme.vars.palette.action.selected,
            color: theme.vars.palette.text.secondary,
          }),
        },
        ...SOFT_COLORS.map((color) => ({
          props: { variant: 'soft' as const, color },
          style: ({ theme }: { theme: Theme }) => ({
            backgroundColor: theme.vars?.palette[color].soft,
            color: theme.vars?.palette[color].onSoft,
          }),
        })),
      ],
    },
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.subtle,
          color: theme.vars.palette.text.secondary,
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
        }),
        root: { fontVariantNumeric: 'tabular-nums' },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.paper,
          borderColor: theme.vars.palette.divider,
          borderRadius: 6,
          fontVariantNumeric: 'tabular-nums',
          '--DataGrid-containerBackground': theme.vars.palette.background.subtle,
        }),
        columnHeaderTitle: ({ theme }) => ({
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
          color: theme.vars.palette.text.secondary,
        }),
        columnHeader: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.subtle,
          minHeight: 44,
          maxHeight: 44,
        }),
        columnSeparator: { display: 'none' },
      },
    },
    MuiSvgIcon: {
      variants: [
        {
          props: { fontSize: 'xlarge' },
          style: { fontSize: '2.5rem' /* 40px */ },
        },
      ],
    },
  },
},
// Idioma: textos de DataGrid ("Filas por página", "1–25 de 132") y de los
// componentes base de MUI en español, para todas las tablas.
dataGridEsES,
materialEsES,
)
