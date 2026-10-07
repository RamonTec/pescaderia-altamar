'use client'

import { ErrorState } from '@/components/molecules/ErrorState'

/**
 * Fallo al cargar la ficha en el servidor. `retry` (Next 16) vuelve a pedir
 * los datos al servidor y re-renderiza; `reset` solo re-renderizaría con el
 * mismo error.
 */
export default function Error({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <ErrorState
      message="No se pudo cargar la ficha del proveedor. Revisa tu conexión y vuelve a intentarlo."
      onRetry={retry}
    />
  )
}