'use client'

import * as React from 'react'
import { SkeletonGrafico } from '@/components/atoms/Skeletons'

/**
 * Fallbacks de los `Suspense` del dashboard (15): la forma de cada sección
 * con `SkeletonGrafico` (título real + gráfico en pulso), para que una consulta lenta no mueva el resto.
 * `columnas` usa el mismo grid que la sección real.
 */
export function SeccionSkeleton({
  titulos,
  altura = 260,
  columnas = 'md:grid-cols-2',
}: {
  titulos: string[]
  altura?: number
  columnas?: string
}) {
  return (
    <div className={`grid min-w-0 gap-4 ${columnas}`} aria-busy="true" aria-live="polite">
      {titulos.map((t) => (
        <SkeletonGrafico key={t} titulo={t} altura={altura} />
      ))}
    </div>
  )
}
