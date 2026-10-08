'use client'

import * as React from 'react'
import { ChartCard } from '@/components/molecules/ChartCard'

/**
 * Fallbacks de los `Suspense` del dashboard (15): la forma de cada sección
 * con `ChartCard loading`, para que una consulta lenta no mueva el resto.
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
        <ChartCard key={t} title={t} loading skeletonHeight={altura} />
      ))}
    </div>
  )
}
