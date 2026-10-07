import { PageLoader } from '@/components/atoms/PageLoader'

/** Respaldo para las rutas sin `loading.tsx` propio (inicio, perfil, usuarios, inventario). Renderiza dentro del shell. */
export default function Loading() {
  return <PageLoader variant="table" />
}
