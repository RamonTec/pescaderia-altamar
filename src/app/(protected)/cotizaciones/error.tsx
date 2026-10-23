'use client'

import { ErrorState } from '@/components/molecules/ErrorState'

export default function Error({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorState message="No se pudieron cargar las cotizaciones." onRetry={retry} />
}
