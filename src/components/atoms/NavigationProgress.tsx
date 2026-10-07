'use client'

import * as React from 'react'
import { useLinkStatus } from 'next/link'
import Box from '@mui/material/Box'
import { PeneroSweep } from '@/components/atoms/PeneroStripes'

/**
 * Progreso de navegación (nivel 2 de loaders, ver spec § Loaders).
 *
 * Fuentes que la encienden:
 * - `NavLinkStatus` dentro de cada `<Link>` del menú (`useLinkStatus`: el clic
 *   todavía no actualizó la URL porque la ruta no estaba precargada).
 * - `PageLoader` (los `loading.tsx`) mientras está montado.
 *
 * Cada fuente se registra con un id; la barra está activa mientras haya al
 * menos una. Fuera de `NavigationProgressProvider` (ej. pantallas de auth)
 * todo es no-op.
 */
interface NavigationProgressApi {
  add: (id: string) => void
  remove: (id: string) => void
}

const ApiContext = React.createContext<NavigationProgressApi | null>(null)
const ActiveContext = React.createContext(false)

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = React.useState<ReadonlySet<string>>(() => new Set())

  const api = React.useMemo<NavigationProgressApi>(
    () => ({
      add: (id) =>
        setSources((prev) => {
          if (prev.has(id)) return prev
          const next = new Set(prev)
          next.add(id)
          return next
        }),
      remove: (id) =>
        setSources((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        }),
    }),
    []
  )

  return (
    <ApiContext.Provider value={api}>
      <ActiveContext.Provider value={sources.size > 0}>{children}</ActiveContext.Provider>
    </ApiContext.Provider>
  )
}

/** Registra una fuente de progreso mientras `active` sea `true` y el componente esté montado. */
export function useNavigationPending(active: boolean) {
  const api = React.useContext(ApiContext)
  const id = React.useId()
  React.useEffect(() => {
    if (!api || !active) return
    api.add(id)
    return () => api.remove(id)
  }, [api, active, id])
}

/** Va dentro de un `<Link>`: reporta su estado pendiente a la barra. */
export function NavLinkStatus() {
  const { pending } = useLinkStatus()
  useNavigationPending(pending)
  return null
}

export interface NavigationProgressProps {
  /** Fuerza el estado (página de muestra). Por defecto lee el provider. */
  active?: boolean
}

/**
 * Barra de 3 px con las franjas de la borda. Se ubica arriba del área de
 * contenido (el shell la pone en el borde inferior de la barra superior).
 * Aparece con 100 ms de retardo para no parpadear en navegaciones rápidas.
 */
export function NavigationProgress({ active }: NavigationProgressProps) {
  const fromProvider = React.useContext(ActiveContext)
  const on = active ?? fromProvider

  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        height: 3,
        width: '100%',
        pointerEvents: 'none',
        visibility: on ? 'visible' : 'hidden',
        animation: on
          ? `penero-fade-in ${theme.transitions.duration.shorter}ms ${theme.transitions.easing.easeOut} 100ms both`
          : 'none',
      })}
    >
      {on ? <PeneroSweep height={3} /> : null}
    </Box>
  )
}
