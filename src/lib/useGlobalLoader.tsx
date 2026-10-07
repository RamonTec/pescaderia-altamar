'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { BrandLoader } from '@/components/organisms/BrandLoader'

/**
 * Loader global con logo (nivel 1 de spec § Loaders): carga posterior al
 * login, cierre de sesión y operaciones que bloquean toda la pantalla.
 *
 * - Aparece a los 150 ms: si la operación termina antes, no parpadea.
 * - Una vez visible, dura al menos 400 ms.
 * - Contador: llamadas anidadas mantienen el loader hasta que se liberan todas.
 *   El mensaje visible es el de la llamada más reciente.
 * - `untilNavigation`: la llamada se libera sola cuando cambia la ruta (útil
 *   con Server Actions que terminan en `redirect()`, cuya promesa no resuelve).
 */
const SHOW_DELAY_MS = 150
const MIN_VISIBLE_MS = 400

export interface GlobalLoaderShowOptions {
  untilNavigation?: boolean
}

export interface GlobalLoader {
  /** Enciende el loader. Devuelve la función que libera esta llamada. */
  show: (message?: string, options?: GlobalLoaderShowOptions) => () => void
  /** Libera la llamada más reciente hecha sin `untilNavigation`. */
  hide: () => void
  /** Envuelve una tarea: `show` antes, libera al terminar (o al fallar). */
  run: <T>(task: () => Promise<T>, message?: string) => Promise<T>
}

interface Entry {
  id: number
  message?: string
  /** Ruta en la que se pidió; la llamada deja de contar al salir de ella. */
  navFrom: string | null
}

const GlobalLoaderContext = React.createContext<GlobalLoader | null>(null)

export function GlobalLoaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pathnameRef = React.useRef(pathname)
  React.useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const [entries, setEntries] = React.useState<Entry[]>([])
  const nextId = React.useRef(0)

  // Al cambiar de ruta se descartan las llamadas `untilNavigation` de rutas anteriores.
  const [prevPathname, setPrevPathname] = React.useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setEntries((prev) => prev.filter((e) => e.navFrom === null || e.navFrom === pathname))
  }

  // Las llamadas `untilNavigation` dejan de contar al cambiar de ruta (estado derivado).
  const live = entries.filter((e) => e.navFrom === null || e.navFrom === pathname)
  const active = live.length > 0
  const message = live.at(-1)?.message

  const [visible, setVisible] = React.useState(false)
  const [shownMessage, setShownMessage] = React.useState<string | undefined>(undefined)
  const shownAt = React.useRef(0)

  React.useEffect(() => {
    if (active && !visible) {
      const t = window.setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, SHOW_DELAY_MS)
      return () => window.clearTimeout(t)
    }
    if (!active && visible) {
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current))
      const t = window.setTimeout(() => setVisible(false), remaining)
      return () => window.clearTimeout(t)
    }
  }, [active, visible])

  // Conserva el último mensaje mientras el loader se desvanece.
  if (active && message !== shownMessage) {
    setShownMessage(message)
  }

  const api = React.useMemo<GlobalLoader>(() => {
    const release = (id: number) => setEntries((prev) => prev.filter((e) => e.id !== id))
    const show: GlobalLoader['show'] = (msg, options) => {
      const id = ++nextId.current
      const here = pathnameRef.current
      setEntries((prev) => [
        // Limpia llamadas `untilNavigation` de rutas anteriores.
        ...prev.filter((e) => e.navFrom === null || e.navFrom === here),
        { id, message: msg, navFrom: options?.untilNavigation ? here : null },
      ])
      return () => release(id)
    }
    return {
      show,
      hide: () =>
        setEntries((prev) => {
          const idx = prev.findLastIndex((e) => e.navFrom === null)
          return idx === -1 ? prev : prev.filter((_, i) => i !== idx)
        }),
      run: async (task, msg) => {
        const done = show(msg)
        try {
          return await task()
        } finally {
          done()
        }
      },
    }
  }, [])

  return (
    <GlobalLoaderContext.Provider value={api}>
      {children}
      <BrandLoader open={visible} message={shownMessage} />
    </GlobalLoaderContext.Provider>
  )
}

export function useGlobalLoader(): GlobalLoader {
  const ctx = React.useContext(GlobalLoaderContext)
  if (!ctx) {
    throw new Error('useGlobalLoader debe usarse dentro de <GlobalLoaderProvider>')
  }
  return ctx
}
