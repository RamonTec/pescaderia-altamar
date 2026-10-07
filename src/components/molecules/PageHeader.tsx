'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined'

export interface PageHeaderAction {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  /** Navega en vez de ejecutar `onClick`. */
  href?: string
  disabled?: boolean
  loading?: boolean
}

export interface PageHeaderProps {
  /** Título `h4` (uno por pantalla). */
  title: React.ReactNode
  /** Contexto bajo el título (`body2`). */
  subtitle?: React.ReactNode
  /**
   * Acción principal ("Nuevo cliente"): botón `contained` en `sm+` y `Fab`
   * fijo abajo a la derecha en `xs`.
   */
  primaryAction?: PageHeaderAction
  /** Acciones secundarias: botones `outlined` en `sm+`, menú `⋮` en `xs`. */
  secondaryActions?: PageHeaderAction[]
  /**
   * Acciones libres (API original). Se muestran tal cual a la derecha en
   * `sm+` y debajo del título en `xs`. Para pantallas nuevas, preferir
   * `primaryAction` / `secondaryActions`.
   */
  children?: React.ReactNode
}

function linkProps(action: PageHeaderAction) {
  return action.href ? { component: Link, href: action.href } : { onClick: action.onClick }
}

export function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  children,
}: PageHeaderProps) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const menuId = React.useId()
  const hasSecondary = !!secondaryActions?.length

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        justifyContent: 'space-between',
        gap: 1.5,
        mb: { xs: 2.5, md: 3 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: '75ch' }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        {/* xs: secundarias en ⋮ */}
        {hasSecondary ? (
          <>
            <IconButton
              aria-label="Más acciones"
              aria-haspopup="menu"
              aria-controls={anchor ? menuId : undefined}
              aria-expanded={anchor ? 'true' : undefined}
              onClick={(e) => setAnchor(e.currentTarget)}
              sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: 'text.secondary' }}
            >
              <MoreVertOutlinedIcon />
            </IconButton>
            <Menu
              id={menuId}
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={() => setAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {secondaryActions?.map((action) => (
                <MenuItem
                  key={action.label}
                  disabled={action.disabled || action.loading}
                  {...(action.href ? { component: Link, href: action.href } : {})}
                  onClick={() => {
                    setAnchor(null)
                    if (!action.href) action.onClick?.()
                  }}
                >
                  {action.icon ? <ListItemIcon>{action.icon}</ListItemIcon> : null}
                  <ListItemText slotProps={{ primary: { variant: 'body2' } }}>
                    {action.label}
                  </ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : null}
      </Box>

      {children || hasSecondary || primaryAction ? (
        <Box
          sx={{
            // En xs las primarias/secundarias van al Fab y al ⋮: sin `children`
            // esta fila queda vacía y solo sumaría el `gap` del encabezado.
            display: { xs: children ? 'flex' : 'none', sm: 'flex' },
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {children}
          {secondaryActions?.map((action) => (
            <Button
              key={action.label}
              variant="outlined"
              startIcon={action.icon}
              loadingPosition={action.icon ? 'start' : undefined}
              disabled={action.disabled}
              loading={action.loading}
              {...linkProps(action)}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              {action.label}
            </Button>
          ))}
          {primaryAction ? (
            <Button
              variant="contained"
              startIcon={primaryAction.icon}
              loadingPosition={primaryAction.icon ? 'start' : undefined}
              disabled={primaryAction.disabled}
              loading={primaryAction.loading}
              {...linkProps(primaryAction)}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              {primaryAction.label}
            </Button>
          ) : null}
        </Box>
      ) : null}

      {/* xs: acción principal como Fab, respetando el área segura */}
      {primaryAction ? (
        <Fab
          variant="extended"
          color="primary"
          disabled={primaryAction.disabled || primaryAction.loading}
          {...linkProps(primaryAction)}
          sx={(t) => ({
            display: { xs: 'inline-flex', sm: 'none' },
            position: 'fixed',
            right: 16,
            bottom: 'calc(24px + env(safe-area-inset-bottom))',
            zIndex: t.zIndex.speedDial,
            gap: 1,
          })}
        >
          {primaryAction.icon}
          {primaryAction.label}
        </Fab>
      ) : null}
    </Box>
  )
}
