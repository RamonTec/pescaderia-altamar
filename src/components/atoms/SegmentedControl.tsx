'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
  count?: number
  icon?: React.ReactNode
}

export interface SegmentedControlProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedControlOption<T>[] | SegmentedControlOption<T>[]
  'aria-label': string
  size?: 'small' | 'medium'
  fullWidth?: boolean
  disabled?: boolean
  sx?: SxProps<Theme>
  className?: string
}

/**
 * Control segmentado para filtros de estado y opciones excluyentes.
 * Track con padding de 3px y radio 8; opción de 32 px (medium) y radio 6.
 *
 * En claro: opción seleccionada con fondo `#FFFFFF`, sombra sutil y texto `#0B1B33` 600.
 * En oscuro: opción seleccionada con fondo `#2A3B5C` y texto `#FFFFFF` 600.
 * No seleccionadas: `text.secondary` 500.
 *
 * Siempre mantiene una opción elegida (ignora deselección `null`).
 * Navegación con flechas (ArrowLeft/ArrowRight/Home/End) y scroll horizontal en `xs`.
 */
export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  size = 'medium',
  fullWidth = false,
  disabled = false,
  sx,
  className,
}: SegmentedControlProps<T>) {
  const groupRef = React.useRef<HTMLDivElement | null>(null)

  const handleChange = (_event: React.MouseEvent<HTMLElement>, nextValue: T | null) => {
    // Siempre hay una opción elegida: ignorar deselección nula o mismo valor
    if (nextValue !== null && nextValue !== value) {
      onChange(nextValue)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (disabled || options.length <= 1) return

    const currentIndex = options.findIndex((opt) => opt.value === value)
    if (currentIndex === -1) return

    let targetIndex = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIndex = (currentIndex + 1) % options.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIndex = (currentIndex - 1 + options.length) % options.length
    } else if (event.key === 'Home') {
      targetIndex = 0
    } else if (event.key === 'End') {
      targetIndex = options.length - 1
    }

    if (targetIndex !== -1 && targetIndex !== currentIndex) {
      event.preventDefault()
      const targetOption = options[targetIndex]
      onChange(targetOption.value)
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('button')
      buttons?.[targetIndex]?.focus()
    }
  }

  return (
    <Box
      className={className}
      sx={{
        display: fullWidth ? 'flex' : 'inline-flex',
        maxWidth: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        ...sx,
      }}
    >
      <ToggleButtonGroup
        ref={groupRef}
        value={value}
        exclusive
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        disabled={disabled}
        sx={{
          backgroundColor: (theme) => theme.palette.segmented?.track ?? 'background.subtle',
          p: '3px',
          borderRadius: '8px',
          border: 'none',
          display: 'inline-flex',
          width: fullWidth ? '100%' : 'auto',
          flexWrap: 'nowrap',
          '& .MuiToggleButtonGroup-grouped': {
            border: 'none !important',
            borderRadius: '6px !important',
            mx: 0,
            my: 0,
            minHeight: size === 'small' ? 26 : 32,
            height: size === 'small' ? 26 : 32,
            px: size === 'small' ? 1 : 1.5,
            py: 0,
            textTransform: 'none',
            fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
            fontWeight: 500,
            color: 'text.secondary',
            backgroundColor: 'transparent',
            flex: fullWidth ? 1 : 'initial',
            whiteSpace: 'nowrap',
            transition: (theme) =>
              theme.transitions.create(['background-color', 'color', 'box-shadow'], {
                duration: theme.transitions.duration.shortest,
              }),
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            '&.Mui-selected': {
              backgroundColor: (theme) => theme.palette.segmented?.selected ?? '#FFFFFF',
              color: (theme) => theme.palette.segmented?.selectedText ?? '#0B1B33',
              fontWeight: 600,
              boxShadow: (theme) => theme.palette.segmented?.selectedShadow ?? '0 1px 2px rgba(11,27,51,.16)',
              '&:hover': {
                backgroundColor: (theme) =>
                  theme.palette.segmented?.selectedHover ?? theme.palette.segmented?.selected ?? '#FFFFFF',
              },
            },
            '&.Mui-disabled': {
              opacity: 0.5,
              cursor: 'not-allowed',
            },
          },
        }}
      >
        {options.map((option) => {
          const isSelected = option.value === value
          const accessibleLabel =
            option.count !== undefined ? `${option.label}, ${option.count}` : option.label

          return (
            <ToggleButton
              key={option.value}
              value={option.value}
              aria-label={accessibleLabel}
              tabIndex={isSelected ? 0 : -1}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                }}
              >
                {option.icon}
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      fontSize: '0.75rem',
                      color: isSelected ? 'inherit' : 'text.secondary',
                      opacity: isSelected ? 0.8 : 1,
                      fontWeight: 500,
                      lineHeight: 1,
                    }}
                  >
                    {option.count}
                  </Typography>
                )}
              </Box>
            </ToggleButton>
          )
        })}
      </ToggleButtonGroup>
    </Box>
  )
}
