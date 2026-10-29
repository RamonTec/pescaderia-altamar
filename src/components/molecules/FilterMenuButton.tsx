'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import Typography from '@mui/material/Typography'
import KeyboardArrowDownOutlinedIcon from '@mui/icons-material/KeyboardArrowDownOutlined'
import type { SxProps, Theme } from '@mui/material/styles'
import { SOMBRAS } from '@/theme/tokens'

export interface FilterOption<T extends string = string> {
  value: T
  label: string
  count?: number
}

interface FilterMenuButtonBaseProps<T extends string = string> {
  label: string
  options: readonly FilterOption<T>[] | FilterOption<T>[]
  todosLabel?: string
  disabled?: boolean
  size?: 'small' | 'medium'
  className?: string
  sx?: SxProps<Theme>
}

export interface FilterMenuButtonSingleProps<T extends string = string>
  extends FilterMenuButtonBaseProps<T> {
  multiple?: false
  value: T | null
  onChange: (value: T | null) => void
}

export interface FilterMenuButtonMultiProps<T extends string = string>
  extends FilterMenuButtonBaseProps<T> {
  multiple: true
  value: T[]
  onChange: (value: T[]) => void
}

export type FilterMenuButtonProps<T extends string = string> =
  | FilterMenuButtonSingleProps<T>
  | FilterMenuButtonMultiProps<T>

/**
 * Primitivo de botón-menú para filtros secundarios que no son de estado.
 *
 * Muestra el valor en la etiqueta ("Tipo: todos", "Tipo: Crudo", o "Tipo: 2" si hay varias).
 * Soporta selección única (Radio) o múltiple (Checkbox), elevación 1 y acción de "Limpiar".
 */
export function FilterMenuButton<T extends string = string>(props: FilterMenuButtonProps<T>) {
  const {
    label,
    options,
    todosLabel = 'todos',
    disabled = false,
    size = 'small',
    className,
    sx,
  } = props

  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const menuId = React.useId()
  const open = Boolean(anchor)

  const isMultiple = Boolean(props.multiple)
  const isFiltered = isMultiple
    ? Array.isArray(props.value) && props.value.length > 0
    : props.value !== null && props.value !== '' && props.value !== undefined

  const getButtonText = (): string => {
    if (isMultiple) {
      const selected = Array.isArray(props.value) ? props.value : []
      if (selected.length === 0) {
        return `${label}: ${todosLabel}`
      }
      if (selected.length === 1) {
        const opt = options.find((o) => o.value === selected[0])
        return `${label}: ${opt ? opt.label : selected[0]}`
      }
      return `${label}: ${selected.length}`
    }

    const singleVal = (props as FilterMenuButtonSingleProps<T>).value
    if (singleVal === null || singleVal === '' || singleVal === undefined) {
      return `${label}: ${todosLabel}`
    }
    const opt = options.find((o) => o.value === singleVal)
    return `${label}: ${opt ? opt.label : singleVal}`
  }

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget)
  }

  const handleClose = () => {
    setAnchor(null)
  }

  return (
    <>
      <Button
        variant="outlined"
        size={size}
        disabled={disabled}
        onClick={handleOpen}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open ? 'true' : undefined}
        className={className}
        endIcon={
          <KeyboardArrowDownOutlinedIcon
            sx={{
              fontSize: 18,
              transition: 'transform 150ms ease',
              transform: open ? 'rotate(180deg)' : 'none',
            }}
          />
        }
        sx={[
          {
            height: size === 'small' ? 32 : 40,
            px: 1.5,
            py: 0,
            textTransform: 'none',
            fontSize: size === 'small' ? '0.8125rem' : '0.875rem',
            fontWeight: isFiltered ? 600 : 500,
            color: isFiltered ? 'text.primary' : 'text.secondary',
            borderColor: isFiltered ? 'text.primary' : 'outlineBorder',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {getButtonText()}
      </Button>

      <Menu
        id={menuId}
        anchorEl={anchor}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
              maxWidth: 320,
              borderRadius: '8px',
              bgcolor: 'background.elevated',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? SOMBRAS.oscuro.elevacion1
                  : SOMBRAS.claro.elevacion1,
              border: (theme) =>
                theme.palette.mode === 'dark'
                  ? '1px solid var(--mui-palette-dialogDivider, #2C3B55)'
                  : 'none',
              py: 0.5,
            },
          },
        }}
      >
        {!isMultiple ? (
          // Modo selección única
          <>
            <MenuItem
              selected={(props as FilterMenuButtonSingleProps<T>).value === null}
              onClick={() => {
                ;(props as FilterMenuButtonSingleProps<T>).onChange(null)
                handleClose()
              }}
              sx={{ py: 0.75, gap: 1 }}
            >
              <Radio
                checked={(props as FilterMenuButtonSingleProps<T>).value === null}
                size="small"
                tabIndex={-1}
                disableRipple
                sx={{ p: 0 }}
              />
              <ListItemText
                primary={todosLabel}
                slotProps={{
                  primary: {
                    variant: 'body2',
                    sx: {
                      fontWeight:
                        (props as FilterMenuButtonSingleProps<T>).value === null ? 600 : 400,
                    },
                  },
                }}
              />
            </MenuItem>

            {options.map((option) => {
              const isSelected =
                (props as FilterMenuButtonSingleProps<T>).value === option.value
              return (
                <MenuItem
                  key={option.value}
                  selected={isSelected}
                  onClick={() => {
                    ;(props as FilterMenuButtonSingleProps<T>).onChange(option.value)
                    handleClose()
                  }}
                  sx={{ py: 0.75, gap: 1 }}
                >
                  <Radio
                    checked={isSelected}
                    size="small"
                    tabIndex={-1}
                    disableRipple
                    sx={{ p: 0 }}
                  />
                  <ListItemText
                    primary={option.label}
                    slotProps={{
                      primary: {
                        variant: 'body2',
                        sx: { fontWeight: isSelected ? 600 : 400 },
                      },
                    }}
                  />
                  {option.count !== undefined && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 'auto', pl: 1, fontSize: '0.75rem' }}
                    >
                      {option.count}
                    </Typography>
                  )}
                </MenuItem>
              )
            })}

            {isFiltered && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={() => {
                    ;(props as FilterMenuButtonSingleProps<T>).onChange(null)
                    handleClose()
                  }}
                  sx={{ py: 0.75 }}
                >
                  <ListItemText
                    primary="Limpiar"
                    slotProps={{
                      primary: {
                        variant: 'body2',
                        color: 'text.secondary',
                      },
                    }}
                  />
                </MenuItem>
              </>
            )}
          </>
        ) : (
          // Modo selección múltiple
          <>
            {options.map((option) => {
              const multiProps = props as FilterMenuButtonMultiProps<T>
              const currentValues = Array.isArray(multiProps.value) ? multiProps.value : []
              const isSelected = currentValues.includes(option.value)

              return (
                <MenuItem
                  key={option.value}
                  selected={isSelected}
                  onClick={() => {
                    const next = isSelected
                      ? currentValues.filter((v) => v !== option.value)
                      : [...currentValues, option.value]
                    multiProps.onChange(next)
                  }}
                  sx={{ py: 0.75, gap: 1 }}
                >
                  <Checkbox
                    checked={isSelected}
                    size="small"
                    tabIndex={-1}
                    disableRipple
                    sx={{ p: 0 }}
                  />
                  <ListItemText
                    primary={option.label}
                    slotProps={{
                      primary: {
                        variant: 'body2',
                        sx: { fontWeight: isSelected ? 600 : 400 },
                      },
                    }}
                  />
                  {option.count !== undefined && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 'auto', pl: 1, fontSize: '0.75rem' }}
                    >
                      {option.count}
                    </Typography>
                  )}
                </MenuItem>
              )
            })}

            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              disabled={!isFiltered}
              onClick={() => {
                ;(props as FilterMenuButtonMultiProps<T>).onChange([])
              }}
              sx={{ py: 0.75 }}
            >
              <ListItemText
                primary="Limpiar"
                slotProps={{
                  primary: {
                    variant: 'body2',
                    color: isFiltered ? 'text.primary' : 'text.disabled',
                  },
                }}
              />
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  )
}
