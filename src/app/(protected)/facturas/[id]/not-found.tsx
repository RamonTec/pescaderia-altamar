import { PaginaFallback } from '@/components/organisms/PaginaFallback'

export default function NotFound() {
  return (
    <PaginaFallback
      tipo="no-encontrado"
      titulo="Esta factura no existe"
      texto="Puede que el enlace esté mal escrito. Búscala en Cobros o en la ficha del cliente."
      href="/cobros"
      accionLabel="Ir a cobros"
    />
  )
}
