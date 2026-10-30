'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import { Fallback } from './Fallback'

export interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

/**
 * Error al cargar un bloque. Envoltorio de compatibilidad de
 * `Fallback tipo="error"`: tranquiliza ("Tus datos están a salvo") y ofrece
 * "Reintentar".
 */
export function ErrorState({
  message = 'Ocurrió un error al cargar los datos.',
  onRetry,
}: ErrorStateProps) {
  return (
    <Fallback
      tipo="error"
      titulo="Algo salió mal"
      texto={
        <>
          {message} Tus datos están a salvo.
        </>
      }
      accion={
        onRetry ? (
          <Button variant="outlined" onClick={onRetry}>
            Reintentar
          </Button>
        ) : undefined
      }
    />
  )
}
