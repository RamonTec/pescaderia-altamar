'use client'

import { createTheme, type Theme, type Overlays } from '@mui/material/styles'
import { esES as materialEsES } from '@mui/material/locale'
import { esES as dataGridEsES } from '@mui/x-data-grid/locales'
import type {} from '@mui/x-data-grid/themeAugmentation'
import { MARCA_CLARO, MARCA_OSCURO } from './marca'
import { MOTION, SOMBRAS } from './tokens'

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
    elevated: string
    field: string
  }
  interface PaletteColor {
    soft?: string
    onSoft?: string
    dot?: string
  }
  interface SimplePaletteColorOptions {
    soft?: string
    onSoft?: string
    dot?: string
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
    rowDivider: string
    dialogDivider: string
    scrim: string
    focusRing: string
    highlight: string
    outlineBorder: string
    segmented: {
      track: string
      selected: string
      selectedHover: string
      selectedText: string
      selectedShadow: string
    }
    neutral: PaletteColor
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
    rowDivider?: string
    dialogDivider?: string
    scrim?: string
    focusRing?: string
    highlight?: string
    outlineBorder?: string
    segmented?: {
      track: string
      selected: string
      selectedHover: string
      selectedText: string
      selectedShadow: string
    }
    neutral?: SimplePaletteColorOptions
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

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    neutral: true
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsVariantOverrides {
    soft: true
  }
  interface ChipPropsColorOverrides {
    neutral: true
  }
}

declare module '@mui/material/SvgIcon' {
  interface SvgIconPropsSizeOverrides {
    xlarge: true
  }
}

const SOFT_COLORS = ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'neutral'] as const

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
        primary: { main: '#0B1B33', contrastText: '#FFFFFF', soft: '#E6ECF5', onSoft: '#0B1B33', dot: '#0B1B33' },
        secondary: { main: '#7A5C2E', contrastText: '#FFFFFF', soft: '#F5EEE3', onSoft: '#7A5C2E', dot: '#7A5C2E' },
        success: { main: '#2F5E9E', light: '#ABC7F1', contrastText: '#FFFFFF', soft: '#ABC7F1', onSoft: '#0B1B33', dot: '#2F5E9E' },
        warning: { main: '#A15C07', contrastText: '#FFFFFF', soft: '#F8EEDD', onSoft: '#7E4705', dot: '#A15C07' },
        error: { main: '#B3261E', contrastText: '#FFFFFF', soft: '#F8E5E3', onSoft: '#8E1F18', dot: '#B3261E' },
        info: { main: '#44597A', contrastText: '#FFFFFF', soft: '#E1E8F2', onSoft: '#26374F', dot: '#44597A' },
        neutral: { main: '#4A5260', contrastText: '#FFFFFF', soft: '#EDEBE5', onSoft: '#4A5260', dot: '#8A909C' },
        background: {
          default: '#F7F6F2',
          paper: '#FFFFFF',
          subtle: '#F0EEE7',
          elevated: '#FFFFFF',
          field: '#FFFFFF',
        },
        text: { primary: '#0B1B33', secondary: '#5B6474' },
        divider: '#E4E1D8',
        inputBorder: '#A9A397',
        rowDivider: '#E4E1D8',
        dialogDivider: '#E4E1D8',
        scrim: 'rgba(11, 27, 51, 0.55)',
        focusRing: 'rgba(201, 166, 107, 0.55)',
        highlight: '#FBF4E6',
        outlineBorder: '#CFCAB9',
        segmented: {
          track: '#F0EEE7',
          selected: '#FFFFFF',
          selectedHover: '#FFFFFF',
          selectedText: '#0B1B33',
          selectedShadow: '0 1px 2px rgba(11, 27, 51, 0.16), 0 0 0 1px rgba(11, 27, 51, 0.06)',
        },
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
        primary: { main: '#D4B27A', contrastText: '#241A0B', soft: 'rgba(212, 178, 122, 0.16)', onSoft: '#D4B27A', dot: '#D4B27A' },
        secondary: { main: '#D4B27A', contrastText: '#241A0B', soft: 'rgba(212, 178, 122, 0.16)', onSoft: '#D4B27A', dot: '#D4B27A' },
        success: { main: '#ABC7F1', contrastText: '#0B1B33', soft: '#2A3A53', onSoft: '#ABC7F1', dot: '#ABC7F1' }, // DS-8: 16% opaco sobre #121F35 (#2A3A53)
        warning: { main: '#E9B460', contrastText: '#241A0B', soft: '#34373C', onSoft: '#E9B460', dot: '#E9B460' }, // DS-8: 16% opaco sobre #121F35 (#34373C)
        error: { main: '#EE8A83', contrastText: '#241A0B', soft: '#3D2228', onSoft: '#EE8A83', dot: '#EE8A83' }, // DS-8: #3D2228 opaco
        info: { main: '#9FB4D3', contrastText: '#0A1424', soft: 'rgba(159, 180, 211, 0.16)', onSoft: '#9FB4D3', dot: '#9FB4D3' },
        neutral: { main: '#A3ADBD', contrastText: '#0A1424', soft: '#22314B', onSoft: '#A3ADBD', dot: '#A3ADBD' },
        background: {
          default: '#0A1424',
          paper: '#121F35',
          subtle: '#17253D',
          elevated: '#1A2A45',
          field: '#0F1C31',
        },
        text: { primary: '#EEF0F4', secondary: '#A3ADBD' },
        divider: '#22314B',
        inputBorder: '#5E7194', // >= 3:1 de contraste en oscuro
        rowDivider: '#1D2B44',
        dialogDivider: '#2C3B55',
        scrim: 'rgba(0, 0, 0, 0.6)', // DS-8
        focusRing: '#D4B27A',
        highlight: 'rgba(212, 178, 122, 0.12)', // DS-8
        outlineBorder: '#3A4B6A', // DS-8
        segmented: {
          track: '#0F1C31',
          selected: '#2A3B5C',
          selectedHover: '#2F4268',
          selectedText: '#FFFFFF',
          selectedShadow: 'none',
        },
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
      // Mecanismo de anulación de la capa de elevación de MUI (tarea 97 / spec.md § Superficies por nivel):
      // En MUI v9 (@mui/material 9.4.0), PaperRoot aplica `backgroundImage: 'var(--Paper-overlay)'`
      // para variant="elevation", cuyo valor viene de theme.vars.overlays[elevation].
      // Anulamos los 25 niveles para que no aclare los componentes elevados:
      overlays: Array(25).fill('none') as unknown as Overlays,
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
  // Movimiento (spec.md § Movimiento y tarea 95). Se alimenta de tokens.ts.
  transitions: {
    duration: {
      shortest: MOTION.duraciones.rapida, // 120 ms: hover, presión, cambio de estado
      shorter: MOTION.duraciones.rapida, // 120 ms
      short: MOTION.duraciones.media, // 200 ms: menús, toasts, acordeones
      standard: MOTION.duraciones.media, // 200 ms
      complex: MOTION.duraciones.lenta, // 280 ms: modales y drawers entrada
      enteringScreen: MOTION.duraciones.lenta, // 280 ms
      leavingScreen: MOTION.duraciones.salida, // 180 ms: modales y drawers salida
    },
    easing: {
      easeInOut: MOTION.curvas.entrada,
      easeOut: MOTION.curvas.entrada, // cubic-bezier(.2,0,0,1)
      easeIn: MOTION.curvas.salida, // cubic-bezier(.4,0,1,1)
      sharp: MOTION.curvas.salida,
    },
  },
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
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: { borderRadius: 8 },
      },
      variants: [
        {
          props: { variant: 'elevation', elevation: 0 },
          style: ({ theme }) => ({ border: `1px solid ${theme.vars.palette.divider}` }),
        },
      ],
    },
    MuiBackdrop: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.vars.palette.scrim,
        }),
      },
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
        modal: ({ theme }) => ({
          '& .MuiDrawer-paper': {
            backgroundColor: theme.vars.palette.background.elevated,
            boxShadow: SOMBRAS.claro.elevacion2,
            ...theme.applyStyles('dark', {
              boxShadow: SOMBRAS.oscuro.elevacion2,
            }),
          },
        }),
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.elevated,
          borderRadius: 6,
          boxShadow: SOMBRAS.claro.elevacion1,
          ...theme.applyStyles('dark', {
            boxShadow: SOMBRAS.oscuro.elevacion1,
            border: `1px solid ${theme.vars.palette.dialogDivider}`,
          }),
        }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.elevated,
          borderRadius: 6,
          boxShadow: SOMBRAS.claro.elevacion1,
          ...theme.applyStyles('dark', {
            boxShadow: SOMBRAS.oscuro.elevacion1,
            border: `1px solid ${theme.vars.palette.dialogDivider}`,
          }),
        }),
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.elevated,
          borderRadius: 6,
          boxShadow: SOMBRAS.claro.elevacion1,
          ...theme.applyStyles('dark', {
            boxShadow: SOMBRAS.oscuro.elevacion1,
            border: `1px solid ${theme.vars.palette.dialogDivider}`,
          }),
        }),
      },
    },
    MuiMenuItem: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 8,
          backgroundColor: theme.vars.palette.background.elevated,
          boxShadow: SOMBRAS.claro.elevacion2,
          ...theme.applyStyles('dark', {
            boxShadow: SOMBRAS.oscuro.elevacion2,
            border: `1px solid ${theme.vars.palette.dialogDivider}`,
          }),
        }),
        paperFullScreen: { borderRadius: 0, border: 0 },
      },
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
