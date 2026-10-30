'use client'

import { RouteError } from '@/components/organisms/RouteError'

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError mensaje="No se pudo cargar la ficha del proveedor. Revisa tu conexión y vuelve a intentarlo." retry={retry} digest={error.digest} />
}
