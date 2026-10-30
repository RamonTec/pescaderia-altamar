import { PaginaFallback } from '@/components/organisms/PaginaFallback'

export default function NotFound() {
  return (
    <PaginaFallback
      tipo="no-encontrado"
      titulo="Esta compra no existe"
      texto="Puede que el enlace esté mal escrito. Búscala en Compras o en la ficha del proveedor."
      href="/compras"
      accionLabel="Ir a compras"
    />
  )
}
