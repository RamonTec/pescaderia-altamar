'use client'

import * as React from 'react'
import Link from 'next/link'
import Button from '@mui/material/Button'
import { Fallback, type FallbackTipo } from '@/components/molecules/Fallback'

export interface PaginaFallbackProps {
  tipo: Extract<FallbackTipo, 'no-encontrado' | 'sin-permiso'>
  titulo: string
  texto?: string
  /** Destino de la acción; por defecto, el inicio. */
  href?: string
  /** Texto de la acción; por defecto, "Volver al inicio". */
  accionLabel?: string
}

/**
 * Página entera de fallback (spec § Fallbacks): 404 de una ficha o de una
 * URL inexistente y "sin permiso" en las rutas solo admin. Una sola acción,
 * un enlace que saca al usuario de ahí.
 */
export function PaginaFallback({
  tipo,
  titulo,
  texto,
  href = '/',
  accionLabel = 'Volver al inicio',
}: PaginaFallbackProps) {
  return (
    <Fallback
      tipo={tipo}
      titulo={titulo}
      texto={texto}
      accion={
        <Button component={Link} href={href} variant="contained">
          {accionLabel}
        </Button>
      }
    />
  )
}

/** Ruta solo admin vista por un operador (`forbidden()` sigue experimental en Next 16). */
export function SinPermiso() {
  return (
    <PaginaFallback
      tipo="sin-permiso"
      titulo="No tienes acceso a esta sección"
      texto="Solo un administrador puede verla. Si la necesitas, pídele acceso."
    />
  )
}
