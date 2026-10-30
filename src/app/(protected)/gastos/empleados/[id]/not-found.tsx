import { PaginaFallback } from '@/components/organisms/PaginaFallback'

export default function NotFound() {
  return (
    <PaginaFallback
      tipo="no-encontrado"
      titulo="Empleado no encontrado"
      texto="El empleado que buscas no existe."
      href="/gastos?tab=empleados"
      accionLabel="Volver a empleados"
    />
  )
}
