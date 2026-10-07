import { notFound } from 'next/navigation'
import { getUsuarioActual } from '@/lib/services/authService'
import { EstandaresScreen } from './estandares-screen'

/**
 * Página de muestra de los componentes base (specs/00-estandares-ui, tarea 39).
 * Solo en desarrollo y solo para administradores. No usa `_estandares`: una
 * carpeta con `_` es privada en el App Router y no genera ruta.
 */
export default async function EstandaresPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  const usuario = await getUsuarioActual()
  if (usuario?.rol !== 'admin') notFound()

  return <EstandaresScreen />
}
