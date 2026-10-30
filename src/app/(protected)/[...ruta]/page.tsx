import { notFound } from 'next/navigation'

/**
 * URL inexistente dentro de la app: sin esta ruta, Next la manda al
 * `not-found` raíz, fuera del shell. Así cae en `(protected)/not-found.tsx`,
 * con la navegación a la vista.
 */
export default function RutaInexistente() {
  notFound()
}
