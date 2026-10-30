'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Slide from '@mui/material/Slide'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import type { TransitionProps } from '@mui/material/transitions'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import { useConfirm } from '@/lib/useConfirm'

/**
 * Todo diálogo de formulario (spec § Modales y § Design system › Patrones ›
 * Formulario). `ConfirmDialog` sigue siendo el de confirmar.
 *
 * - Tamaños: `xs` 400 px (confirmaciones, un campo), `sm` 600 px (entidad
 *   simple), `md` 900 px (secciones o pasos), `lg` 1120 px (líneas
 *   repetibles o más de dos secciones).
 * - Una sola superficie (`background.elevated`, la pinta el theme): ningún
 *   hijo pinta `background.paper`. Encabezado, cuerpo y pie separados por
 *   `dialogDivider`; padding de 24 (16 en `xs`).
 * - Anatomía: encabezado (título `h6` = la acción, subtítulo con el contexto,
 *   cerrar) → `Alert` de error con "Reintentar" opcional → contenido con
 *   scroll propio → pie fijo (secundario a la izquierda, primario a la
 *   derecha).
 * - Entra con fundido + 8 px hacia arriba (theme). En `xs`, `sm`/`md` pasan a
 *   pantalla completa con `Slide` desde abajo, y `lg` por debajo de `md`; el
 *   pie respeta el área segura y el primario ocupa el ancho.
 * - Cierre protegido: con `pending` no se cierra (X, Esc, clic fuera, Cancelar);
 *   con `dirty` pide "¿Descartar cambios?".
 * - Foco al primer campo al abrir; MUI lo devuelve al disparador al cerrar.
 * - Con `onSubmit`, el diálogo entero es un `<form>`: el primario es
 *   `type="submit"`.
 */
export type AppDialogSize = 'xs' | 'sm' | 'md' | 'lg'

const WIDTHS: Record<AppDialogSize, number> = { xs: 400, sm: 600, md: 900, lg: 1120 }

const PADDING_X = { xs: 2, sm: 3 } as const

export interface AppDialogProps {
  open: boolean
  /** Se llama después de pasar la protección de cierre. */
  onClose: () => void
  size?: AppDialogSize
  /** La acción: "Registrar abono". */
  title: React.ReactNode
  /** Contexto: "Factura 0123 · Restaurante El Muelle". */
  subtitle?: React.ReactNode
  /** Botón primario (normalmente `<Button type="submit" variant="contained" loading={pending}>`). */
  primaryAction?: React.ReactNode
  /** Acciones secundarias extra, a la izquierda junto a "Cancelar". */
  secondaryActions?: React.ReactNode
  /** Texto del botón cancelar. `null` lo oculta. */
  cancelLabel?: string | null
  /** Acción en curso: bloquea el cierre y el botón cancelar. */
  pending?: boolean
  /** Cambios sin guardar: cerrar pide confirmación. */
  dirty?: boolean
  /** Error del servidor, arriba del contenido. */
  error?: string | null
  /** Si se pasa, la alerta de error ofrece "Reintentar". */
  onRetry?: () => void
  /**
   * Pie custom (tarea 12, 11-refactor-visual-proveedores): reemplaza el pie
   * estándar completo (Cancelar + secundarias + primaria) cuando un diálogo
   * necesita su propia barra de navegación (ej. el Stepper de ProveedorForm:
   * Anterior / Siguiente / "Guardar y continuar" / Finalizar). Recibe la
   * misma barra con área segura de `xs`; el `pending` que bloquea el cierre
   * lo sigue gestionando el diálogo. Sin `footer`, el pie estándar.
   */
  footer?: React.ReactNode
  /** Si se pasa, el diálogo es un `<form noValidate>`. */
  onSubmit?: React.FormEventHandler<HTMLFormElement>
  /** `false` desactiva el foco automático al primer campo. */
  autoFocusFirstField?: boolean
  children: React.ReactNode
}

const SlideUp = React.forwardRef(function SlideUp(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />
})

const FOCUSABLE_FIELD =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([aria-disabled="true"])'

export function AppDialog({
  open,
  onClose,
  size = 'sm',
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  cancelLabel = 'Cancelar',
  pending = false,
  dirty = false,
  error,
  onRetry,
  footer,
  onSubmit,
  autoFocusFirstField = true,
  children,
}: AppDialogProps) {
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))
  const fullScreen = (isXs && size !== 'xs') || (isMdDown && size === 'lg')
  const confirm = useConfirm()
  const titleId = React.useId()
  const subtitleId = React.useId()
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [scrollable, setScrollable] = React.useState(false)

  // Con scroll, una sombra interior bajo el encabezado refuerza el divisor.
  // Ref de callback y no `useEffect([open])`: el `Portal` del Dialog monta el
  // contenido un render después de `open`, así que en el efecto la ref
  // todavía era `null` y el observer nunca se conectaba.
  const observeContent = React.useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el
    if (!el) return
    const update = () => setScrollable(el.scrollHeight > el.clientHeight + 1)
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => {
      observer.disconnect()
      contentRef.current = null
    }
  }, [])

  const requestClose = async () => {
    if (pending) return
    if (dirty) {
      const ok = await confirm({
        title: '¿Descartar cambios?',
        message: 'Los datos que escribiste no se van a guardar.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        destructive: true,
      })
      if (!ok) return
    }
    onClose()
  }

  const focusFirstField = () => {
    if (!autoFocusFirstField) return
    const field = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_FIELD)
    field?.focus()
  }

  const closeButton = (
    <IconButton
      aria-label="Cerrar"
      onClick={requestClose}
      disabled={pending}
      edge={fullScreen ? 'start' : 'end'}
      sx={{ color: 'text.secondary' }}
    >
      <CloseOutlinedIcon />
    </IconButton>
  )

  const showCancel = cancelLabel !== null && !fullScreen

  return (
    <Dialog
      open={open}
      onClose={() => void requestClose()}
      fullScreen={fullScreen}
      maxWidth={false}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      aria-busy={pending || undefined}
      slots={fullScreen ? { transition: SlideUp } : undefined}
      slotProps={{
        transition: { onEntered: focusFirstField },
        paper: {
          sx: {
            width: fullScreen ? '100%' : `calc(100% - ${theme.spacing(4)})`,
            maxWidth: fullScreen ? undefined : WIDTHS[size],
            m: fullScreen ? 0 : 2,
            maxHeight: fullScreen ? undefined : `calc(100% - ${theme.spacing(8)})`,
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <Box
        component={onSubmit ? 'form' : 'div'}
        onSubmit={onSubmit}
        noValidate={onSubmit ? true : undefined}
        sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}
      >
        {/* Encabezado */}
        <Box
          sx={{
            display: 'flex',
            alignItems: fullScreen ? 'center' : 'flex-start',
            gap: 1.5,
            px: fullScreen ? 1 : PADDING_X,
            pt: fullScreen ? 0 : 2.5,
            pb: fullScreen ? 0 : 2,
            minHeight: fullScreen ? 60 : undefined,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: 'dialogDivider',
          }}
        >
          {fullScreen ? closeButton : null}
          <Box sx={{ flexGrow: 1, minWidth: 0, display: 'grid', gap: 0.5 }}>
            <Typography id={titleId} variant="h6" component="h2">
              {title}
            </Typography>
            {subtitle ? (
              <Typography id={subtitleId} variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {fullScreen ? null : closeButton}
        </Box>

        {/* Error del servidor, arriba del contenido */}
        <Collapse in={!!error} unmountOnExit sx={{ flexShrink: 0 }}>
          <Box sx={{ px: PADDING_X, pt: 2 }}>
            <Alert
              severity="error"
              action={
                onRetry ? (
                  <Button color="inherit" size="small" onClick={onRetry} disabled={pending}>
                    Reintentar
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Alert>
          </Box>
        </Collapse>

        {/* Contenido con scroll propio */}
        <Box
          ref={observeContent}
          sx={(t) => ({
            flex: '1 1 auto',
            overflowY: 'auto',
            p: PADDING_X,
            boxShadow: scrollable ? `inset 0 1px 0 ${(t.vars ?? t).palette.dialogDivider}` : 'none',
          })}
        >
          <Box>{children}</Box>
        </Box>

        {/* Pie fijo */}
        {footer ? (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: PADDING_X,
              pt: 2,
              pb: fullScreen ? 'calc(16px + env(safe-area-inset-bottom))' : 2,
              borderTop: 1,
              borderColor: 'dialogDivider',
            }}
          >
            {footer}
          </Box>
        ) : primaryAction || showCancel || secondaryActions ? (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: PADDING_X,
              pt: 2,
              pb: fullScreen ? 'calc(16px + env(safe-area-inset-bottom))' : 2,
              borderTop: 1,
              borderColor: 'dialogDivider',
            }}
          >
            {showCancel ? (
              <Button
                onClick={requestClose}
                disabled={pending}
                color="inherit"
                sx={{ color: 'text.secondary' }}
              >
                {cancelLabel}
              </Button>
            ) : null}
            {secondaryActions}
            <Box sx={{ flexGrow: 1 }} />
            {primaryAction ? (
              <Box
                sx={
                  fullScreen
                    ? { flexGrow: 1, '& > .MuiButton-root': { width: '100%', minHeight: 48 } }
                    : undefined
                }
              >
                {primaryAction}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Box>
    </Dialog>
  )
}
