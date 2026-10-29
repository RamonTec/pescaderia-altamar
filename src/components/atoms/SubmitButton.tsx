'use client'

import * as React from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'

export interface SubmitButtonProps
  extends Omit<ButtonProps, 'type' | 'loading' | 'loadingPosition'> {
  type?: 'submit' | 'button' | 'reset'
  /** Estado de envío o carga */
  pending?: boolean
  /** Texto a mostrar mientras está `pending` (por defecto "Guardando…") */
  pendingLabel?: React.ReactNode
}

/**
 * Botón de envío de formulario (primitivo SubmitButton).
 *
 * - Por defecto `contained` con `type="submit"`.
 * - Activa `loading={pending}` y `loadingPosition="start"`.
 * - Muestra spinner al inicio y el texto `pendingLabel` ("Guardando…").
 * - Mide su ancho en reposo y lo fija como `minWidth` mientras está `pending`, evitando saltos visuales.
 * - Bloquea e ignora clics mientras está `pending` (protección contra doble envío).
 */
export const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  function SubmitButton(
    {
      type = 'submit',
      variant = 'contained',
      color = 'primary',
      pending = false,
      pendingLabel = 'Guardando…',
      children,
      disabled,
      onClick,
      sx,
      ...rest
    },
    forwardedRef
  ) {
    const internalRef = React.useRef<HTMLButtonElement | null>(null)
    const [idleWidth, setIdleWidth] = React.useState<number | null>(null)

    // Combinar ref interna y reenviada
    React.useImperativeHandle(forwardedRef, () => internalRef.current as HTMLButtonElement)

    // Medir ancho en reposo para que no salte al cambiar a pending
    React.useLayoutEffect(() => {
      if (!pending && internalRef.current) {
        const rect = internalRef.current.getBoundingClientRect()
        if (rect.width > 0) {
          setIdleWidth(Math.ceil(rect.width))
        }
      }
    }, [pending, children])

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (pending) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      onClick?.(event)
    }

    return (
      <Button
        ref={internalRef}
        type={type}
        variant={variant}
        color={color}
        loading={pending}
        loadingPosition="start"
        disabled={disabled || pending}
        onClick={handleClick}
        sx={{
          ...(pending && idleWidth ? { minWidth: idleWidth } : {}),
          ...sx,
        }}
        {...rest}
      >
        {pending ? pendingLabel : children}
      </Button>
    )
  }
)
