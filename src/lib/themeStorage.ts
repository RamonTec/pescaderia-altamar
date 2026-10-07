'use client'

import type { StorageManager } from '@mui/material/styles'

/**
 * StorageManager de MUI que persiste el modo (`light`/`dark`/`system`) en
 * localStorage y, además, escribe una cookie `mui-mode` para que el servidor
 * pueda renderizar el `<html>` con el atributo `data-mui-color-scheme`
 * correcto desde el primer byte (evita flash of wrong theme).
 *
 * La cookie es legible por el servidor pero se escribe desde el cliente
 * (una Server Action no es necesaria porque el valor ya lo conoce el browser
 * al momento de alternar; en el primer render server-side la cookie todavía
 * no existe y `InitColorSchemeScript` inyecta el atributo vía JS).
 *
 * NOTA: este módulo es 'use client' y solo puede importarse desde componentes
 * cliente. El `ThemeProvider`/`useColorScheme` ya son client-only.
 */

const COOKIE_NAME = 'mui-mode'
const STORAGE_KEY = 'mui-mode'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
}

export const themeStorageManager: StorageManager = ({ key, storageWindow }) => {
  const store = storageWindow && typeof storageWindow !== 'undefined' ? storageWindow : window

  return {
    get(defaultValue) {
      if (typeof window === 'undefined') return undefined
      try {
        if (key === STORAGE_KEY) {
          return (
            getCookie(COOKIE_NAME) ??
            store.localStorage.getItem(key) ??
            defaultValue
          )
        }
        return store.localStorage.getItem(key) ?? defaultValue
      } catch {
        return key === STORAGE_KEY ? getCookie(COOKIE_NAME) ?? defaultValue : defaultValue
      }
    },
    set(value) {
      if (key === STORAGE_KEY) {
        setCookie(COOKIE_NAME, value)
      }
      try {
        store.localStorage.setItem(key, value)
      } catch {
        // localStorage no disponible; la cookie ya conserva el modo
      }
    },
    subscribe(handler) {
      if (typeof window === 'undefined') return () => {}
      const listener = (event: StorageEvent) => {
        if (event.key === key) handler(event.newValue)
      }
      window.addEventListener('storage', listener)
      return () => window.removeEventListener('storage', listener)
    },
  }
}
