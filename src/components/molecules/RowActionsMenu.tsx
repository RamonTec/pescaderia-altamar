'use client'

import * as React from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined'
import type { SxProps, Theme } from '@mui/material/styles'
import { SOMBRAS } from '@/theme/tokens'

export interface RowAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  /** Pinta la opción en `error.main` (y la acción debe pasar por `useConfirm`). */
  destructive?: boolean
  disabled?: boolean
}

export interface RowActionsMenuProps {
  /** Nombre de la fila para el `aria-label` ("Acciones de Hotel Bahía Azul"). */
  label: string
  actions: RowAction[]
  /** Acción en curso sobre esta fila: el menú queda deshabilitado con su indicador. */
  pending?: boolean
  size?: 'small' | 'medium'
  className?: string
  sx?: SxProps<Theme>
}

/**
 * Menú `⋮` de una fila (tabla o tarjeta). Detiene la propagación del clic
 * para no abrir la ficha de la fila. Nunca más de un ícono suelto por fila:
 * todas las acciones van aquí.
 *
 * Disparador de 32 px (44 px en xs para accesibilidad táctil), elevación 1 y
 * opciones destructivas en `error.main` separadas por divisor.
 */
export function RowActionsMenu({
  label,
  actions,
  pending = false,
  size = 'small',
  className,
  sx,
}: RowActionsMenuProps) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const menuId = React.useId()

  if (actions.length === 0) return null

  const normalActions = actions.filter((a) => !a.destructive)
  const destructiveActions = actions.filter((a) => a.destructive)

  return (
    <>
      <IconButton
        aria-label={`Acciones de ${label}`}
        aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        disabled={pending}
        size={size}
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          setAnchor(e.currentTarget)
        }}
        sx={[
          {
            color: 'text.secondary',
            width: { xs: 44, sm: 32 },
            height: { xs: 44, sm: 32 },
            p: { xs: 1.25, sm: 0.5 },
            borderRadius: '6px',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {pending ? (
          <CircularProgress size={16} color="inherit" aria-label="Procesando" />
        ) : (
          <MoreVertOutlinedIcon fontSize="small" />
        )}
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 160,
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
        {normalActions.map((action) => (
          <MenuItem
            key={action.label}
            disabled={action.disabled}
            onClick={() => {
              setAnchor(null)
              action.onClick()
            }}
          >
            {action.icon ? <ListItemIcon>{action.icon}</ListItemIcon> : null}
            <ListItemText slotProps={{ primary: { variant: 'body2' } }}>
              {action.label}
            </ListItemText>
          </MenuItem>
        ))}

        {normalActions.length > 0 && destructiveActions.length > 0 && (
          <Divider sx={{ my: 0.5 }} />
        )}

        {destructiveActions.map((action) => (
          <MenuItem
            key={action.label}
            disabled={action.disabled}
            onClick={() => {
              setAnchor(null)
              action.onClick()
            }}
            sx={{ color: 'error.main' }}
          >
            {action.icon ? (
              <ListItemIcon sx={{ color: 'error.main' }}>
                {action.icon}
              </ListItemIcon>
            ) : null}
            <ListItemText
              slotProps={{
                primary: {
                  variant: 'body2',
                  sx: { color: 'error.main' },
                },
              }}
            >
              {action.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
