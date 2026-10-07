'use client'

import { ErrorState } from '@/components/molecules/ErrorState'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState message="No se pudo cargar la trazabilidad del lote." onRetry={reset} />
}
