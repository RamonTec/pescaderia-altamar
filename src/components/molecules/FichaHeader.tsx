'use client'

import * as React from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import type { PageHeaderAction } from '@/components/molecules/PageHeader'
import { consumirOrigen } from '@/lib/navigationOrigin'

export interface FichaHeaderProps {
  /** Listado al que vuelve ("/clientes"). */
  backHref: string
  /** Texto del enlace de vuelta ("Clientes"). */
  backLabel: string
  /** Nombre de la entidad: `h5` (`component="h1"`). */
  title: string
  /** Línea bajo el nombre: documento copiable, tipo, chips de estado. */
  meta?: React.ReactNode
  /** Acción principal ("Editar cliente"): `outlined` en `sm+`, primera opción del `⋮` en `xs`. */
  primaryAction?: PageHeaderAction
  /** Resto de acciones, en el `⋮`. */
  menuActions?: RowAction[]
  /** Acción en curso sobre la entidad: `⋮` deshabilitado con su indicador y primaria deshabilitada. */
  pending?: boolean
}

/**
 * Encabezado de una ficha de detalle (cliente, proveedor…). La vuelta usa
 * `router.back()` si la ficha se abrió desde ese listado (conserva su página
 * y filtros en la URL); si no (enlace directo, recarga), navega a `backHref`.
 */
export function FichaHeader({
  backHref,
  backLabel,
  title,
  meta,
  primaryAction,
  menuActions = [],
  pending = false,
}: FichaHeaderProps) {
  const router = useRouter()
  // Ref y no estado: en modo estricto el efecto corre dos veces y la segunda
  // ya no encuentra el origen; la ref conserva el `true` de la primera.
  const desdeListado = React.useRef(false)

  React.useEffect(() => {
    if (consumirOrigen(backHref)) desdeListado.current = true
  }, [backHref])

  const handleBack = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Ctrl/⌘ + clic o clic central: comportamiento normal del enlace.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    if (!desdeListado.current) return
    e.preventDefault()
    router.back()
  }

  const runPrimary = () => {
    if (!primaryAction) return
    if (primaryAction.href) router.push(primaryAction.href)
    else primaryAction.onClick?.()
  }

  const accionesXs: RowAction[] = primaryAction
    ? [
        {
          label: primaryAction.label,
          icon: primaryAction.icon,
          onClick: runPrimary,
          disabled: primaryAction.disabled || primaryAction.loading,
        },
        ...menuActions,
      ]
    : menuActions

  return (
    <Box component="header" sx={{ display: 'grid', gap: 1 }}>
      <Link
        component={NextLink}
        href={backHref}
        onClick={handleBack}
        variant="body2"
        underline="hover"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, justifySelf: 'start' }}
      >
        <ArrowBackOutlinedIcon fontSize="small" />
        {backLabel}
      </Link>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ display: 'grid', gap: 0.75, minWidth: 0, flexGrow: 1 }}>
          <Typography variant="h5" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {meta ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                columnGap: 2,
                rowGap: 0.5,
                typography: 'body2',
                color: 'text.secondary',
              }}
            >
              {meta}
            </Box>
          ) : null}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {primaryAction ? (
            <Button
              variant="outlined"
              startIcon={primaryAction.icon}
              loadingPosition={primaryAction.icon ? 'start' : undefined}
              loading={primaryAction.loading}
              disabled={primaryAction.disabled || pending}
              onClick={runPrimary}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              {primaryAction.label}
            </Button>
          ) : null}
          {/* sm+: solo las acciones del menú; xs: también la principal. */}
          {menuActions.length > 0 ? (
            <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              <RowActionsMenu label={title} actions={menuActions} pending={pending} />
            </Box>
          ) : null}
          {accionesXs.length > 0 ? (
            <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
              <RowActionsMenu label={title} actions={accionesXs} pending={pending} />
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  )
}
