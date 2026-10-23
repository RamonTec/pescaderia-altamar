'use client'

import { ErrorState } from '@/components/molecules/ErrorState'

export default function Error({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <ErrorState
      message="No se pudo cargar la cotización. Revisa tu conexión y vuelve a intentarlo."
      onRetry={retry}
    />
  )
}
