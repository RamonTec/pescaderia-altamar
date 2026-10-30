'use client'

import { RouteError } from '@/components/organisms/RouteError'

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError mensaje="No se pudo cargar la trazabilidad del lote." retry={retry} digest={error.digest} />
}
