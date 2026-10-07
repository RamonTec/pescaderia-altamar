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
 * Todo diálogo de formulario (spec § Modales). `ConfirmDialog` sigue siendo
 * el de confirmar.
 *
 * - Tamaños: `xs` 400 px (confirmaciones, un campo), `sm` 600 px (entidad
 *   simple), `md` 900 px (secciones o pasos).
 * - Anatomía: encabezado (título `h6` = la acción, subtítulo con el contexto,
 *   cerrar) → contenido con scroll propio (divisores solo si hay scroll) →
 *   `Alert` de error → pie fijo (secundario a la izquierda, primario a la
 *   derecha).
 * - En `xs`, `sm`/`md` pasan a pantalla completa con `Slide` desde abajo; el
 *   pie respeta el área segura y el primario ocupa el ancho.
 * - Cierre protegido: con `pending` no se cierra (X, Esc, clic fuera, Cancelar);
 *   con `dirty` pide "¿Descartar cambios?".
 * - Foco al primer campo al abrir; MUI lo devuelve al disparador al cerrar.
 * - Con `onSubmit`, el diálogo entero es un `<form>`: el primario es
 *   `type="submit"`.
 */
export type AppDialogSize = 'xs' | 'sm' | 'md'

const WIDTHS: Record<AppDialogSize, number> = { xs: 400, sm: 600, md: 900 }

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
  /** Error del servidor, arriba del pie. */
  error?: string | null
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
  footer,
  onSubmit,
  autoFocusFirstField = true,
  children,
}: AppDialogProps) {
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const fullScreen = isXs && size !== 'xs'
  const confirm = useConfirm()
  const titleId = React.useId()
  const subtitleId = React.useId()
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [scrollable, setScrollable] = React.useState(false)

  // Divisores arriba y abajo solo cuando el contenido tiene scroll.
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
            px: fullScreen ? 1 : 3,
            pt: fullScreen ? 0 : 2.75,
            pb: fullScreen ? 0 : 2.25,
            minHeight: fullScreen ? 60 : undefined,
            flexShrink: 0,
            borderBottom: fullScreen ? 1 : 0,
            borderColor: 'divider',
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

        {/* Contenido con scroll propio */}
        <Box
          ref={observeContent}
          sx={{
            flex: '1 1 auto',
            overflowY: 'auto',
            px: { xs: 2, sm: 3 },
            py: 3,
            borderTop: 1,
            borderBottom: 1,
            borderColor: scrollable && !fullScreen ? 'divider' : 'transparent',
          }}
        >
          <Box>{children}</Box>
        </Box>

        {/* Error del servidor, arriba del pie */}
        <Collapse in={!!error} unmountOnExit>
          <Box sx={{ px: { xs: 2, sm: 3 }, pb: 1 }}>
            <Alert severity="error" sx={{ maxWidth: '75ch' }}>
              {error}
            </Alert>
          </Box>
        </Collapse>

        {/* Pie fijo */}
        {footer ? (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: { xs: 2, sm: 3 },
              pt: 2,
              pb: fullScreen ? 'calc(16px + env(safe-area-inset-bottom))' : 2,
              borderTop: fullScreen ? 1 : 0,
              borderColor: 'divider',
              bgcolor: 'background.paper',
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
              px: { xs: 2, sm: 3 },
              pt: 2,
              pb: fullScreen ? 'calc(16px + env(safe-area-inset-bottom))' : 2,
              borderTop: fullScreen ? 1 : 0,
              borderColor: 'divider',
              bgcolor: 'background.paper',
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
