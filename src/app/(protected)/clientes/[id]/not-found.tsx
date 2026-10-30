import { PaginaFallback } from '@/components/organisms/PaginaFallback'

export default function NotFound() {
  return (
    <PaginaFallback
      tipo="no-encontrado"
      titulo="Este cliente no existe"
      texto="Puede que el enlace esté mal escrito o que el cliente se haya eliminado. Búscalo en el listado."
      href="/clientes"
      accionLabel="Ir a clientes"
    />
  )
}
