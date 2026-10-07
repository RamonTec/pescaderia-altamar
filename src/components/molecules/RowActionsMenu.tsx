'use client'

import * as React from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined'

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
}

/**
 * Menú `⋮` de una fila (tabla o tarjeta). Detiene la propagación del clic
 * para no abrir la ficha de la fila. Nunca más de un ícono suelto por fila:
 * todas las acciones van aquí.
 */
export function RowActionsMenu({
  label,
  actions,
  pending = false,
  size = 'medium',
}: RowActionsMenuProps) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const menuId = React.useId()
  if (actions.length === 0) return null

  return (
    <>
      <IconButton
        aria-label={`Acciones de ${label}`}
        aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        disabled={pending}
        size={size}
        onClick={(e) => {
          e.stopPropagation()
          setAnchor(e.currentTarget)
        }}
        sx={{ color: 'text.secondary' }}
      >
        {pending ? (
          <CircularProgress size={18} color="inherit" aria-label="Procesando" />
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
      >
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            disabled={action.disabled}
            onClick={() => {
              setAnchor(null)
              action.onClick()
            }}
            sx={action.destructive ? { color: 'error.main' } : undefined}
          >
            {action.icon ? (
              <ListItemIcon sx={action.destructive ? { color: 'error.main' } : undefined}>
                {action.icon}
              </ListItemIcon>
            ) : null}
            <ListItemText slotProps={{ primary: { variant: 'body2' } }}>
              {action.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
