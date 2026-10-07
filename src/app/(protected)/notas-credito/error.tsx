'use client'

import { ErrorState } from '@/components/molecules/ErrorState'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState message="No se pudieron cargar las notas de crédito." onRetry={reset} />
}
