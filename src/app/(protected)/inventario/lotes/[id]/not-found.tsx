import { PaginaFallback } from '@/components/organisms/PaginaFallback'

export default function NotFound() {
  return (
    <PaginaFallback
      tipo="no-encontrado"
      titulo="Este lote no existe"
      texto="Puede que el código o el enlace estén mal escritos. Búscalo por código en la pestaña Lotes."
      href="/inventario?tab=lotes"
      accionLabel="Ir a lotes"
    />
  )
}
