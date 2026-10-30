'use client'

import * as React from 'react'
import { Fallback } from './Fallback'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  /** Versión para secciones de una ficha: menos aire y título `subtitle1`. */
  compact?: boolean
}

/** Estado vacío. Envoltorio de compatibilidad de `Fallback tipo="vacio"`. */
export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <Fallback
      tipo="vacio"
      icono={icon}
      titulo={title}
      texto={description}
      accion={action}
      compact={compact}
    />
  )
}
