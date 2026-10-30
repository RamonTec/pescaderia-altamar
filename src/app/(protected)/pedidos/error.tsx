'use client'

import { RouteError } from '@/components/organisms/RouteError'

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError mensaje="No se pudieron cargar los pedidos." retry={retry} digest={error.digest} />
}
