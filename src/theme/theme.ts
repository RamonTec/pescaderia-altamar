'use client'

import { createTheme } from '@mui/material/styles'

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
        primary: { main: '#0288d1' },
        secondary: { main: '#00897b' },
        success: { main: '#2e7d32' },
        warning: { main: '#ed6c02' },
        error: { main: '#d32f2f' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#4fc3f7' },
        secondary: { main: '#4db6ac' },
        success: { main: '#81c784' },
        warning: { main: '#ffb74d' },
        error: { main: '#e57373' },
        background: {
          default: '#121212',
          paper: '#1e1e1e',
        },
      },
    },
  },
  typography: {
    fontFamily: 'var(--font-geist-sans), Arial, sans-serif',
  },
  shape: { borderRadius: 10 },
})
