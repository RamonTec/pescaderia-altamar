import { PaginaFallback } from '@/components/organisms/PaginaFallback'

export default function NotFound() {
  return (
    <PaginaFallback
      tipo="no-encontrado"
      titulo="Esta cotización no existe"
      texto="Puede que el enlace esté mal escrito. Búscala en el listado por número o cliente."
      href="/cotizaciones"
      accionLabel="Ir a cotizaciones"
    />
  )
}
