'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Fallback } from '@/components/molecules/Fallback'

export interface RouteErrorProps {
  /** Qué no se pudo cargar ("No se pudieron cargar los clientes."). */
  mensaje: string
  /** El `retry` de `error.tsx`: vuelve a pedir y renderizar la ruta. */
  retry: () => void
  /** `error.digest`: identifica el error en los registros del servidor. */
  digest?: string
}

/**
 * Error de carga de una ruta (spec § Fallbacks): `Fallback tipo="error"` con
 * "Tus datos están a salvo", "Reintentar" y el código del error si existe.
 * Cada `error.tsx` solo lo instancia con su mensaje.
 */
export function RouteError({ mensaje, retry, digest }: RouteErrorProps) {
  return (
    <Fallback
      tipo="error"
      titulo="Algo salió mal"
      texto={
        <>
          {mensaje} Tus datos están a salvo.
          {digest ? (
            <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', mt: 1 }}>
              Código: {digest}
            </Typography>
          ) : null}
        </>
      }
      accion={
        <Button variant="outlined" onClick={() => retry()}>
          Reintentar
        </Button>
      }
    />
  )
}
