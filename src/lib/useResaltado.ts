'use client'

import * as React from 'react'
import { TIEMPOS } from '@/theme/tokens'

/**
 * Resaltado del ítem afectado tras una acción (spec § Carga y feedback ›
 * Éxito): `resaltar(id)` deja `idResaltado` durante `TIEMPOS.RESALTADO_MS`
 * (2 s). Se pasa como `highlightId` a `AppDataGrid` o `ListaResumen`, que
 * aplican la clase `puerto-resaltado`. Si la fila no está en la página
 * actual, no se fuerza la navegación: simplemente no se ve.
 */
export function useResaltado(): {
  idResaltado: string | number | null
  resaltar: (id: string | number) => void
} {
  const [idResaltado, setIdResaltado] = React.useState<string | number | null>(null)
  const timer = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const resaltar = React.useCallback((id: string | number) => {
    window.clearTimeout(timer.current)
    // Otro id (o el mismo de nuevo): se reinicia la animación.
    setIdResaltado(null)
    window.requestAnimationFrame(() => setIdResaltado(id))
    timer.current = window.setTimeout(() => setIdResaltado(null), TIEMPOS.RESALTADO_MS)
  }, [])

  return { idResaltado, resaltar }
}
