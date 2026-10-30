import { PaginaFallback } from '@/components/organisms/PaginaFallback'

/** `notFound()` dentro de la app sin un `not-found.tsx` más cercano: dentro del shell. */
export default function NotFound() {
  return (
    <PaginaFallback
      tipo="no-encontrado"
      titulo="Esta página no existe"
      texto="Puede que el enlace esté mal escrito o que la página se haya movido."
    />
  )
}
