import { PaginaFallback } from '@/components/organisms/PaginaFallback'

export default function NotFound() {
  return (
    <PaginaFallback
      tipo="no-encontrado"
      titulo="Proveedor no encontrado"
      texto="El proveedor que buscas no existe o fue eliminado."
      href="/proveedores"
      accionLabel="Volver a proveedores"
    />
  )
}
