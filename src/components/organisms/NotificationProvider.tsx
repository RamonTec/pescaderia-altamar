'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Slide from '@mui/material/Slide'
import Typography from '@mui/material/Typography'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import { MOTION, SOMBRAS, TIEMPOS } from '@/theme/tokens'

export type NotifySeverity = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  href?: string
  onClick?: () => void
}

export interface NotifyOptions {
  action?: ToastAction
  durationMs?: number
}

export interface NotifyApi {
  success: (message: string, options?: NotifyOptions) => void
  error: (message: string, options?: NotifyOptions) => void
  info: (message: string, options?: NotifyOptions) => void
}

interface Notification {
  id: number
  severity: NotifySeverity
  message: string
  action?: ToastAction
  durationMs?: number
}

const NotifyContext = React.createContext<NotifyApi | null>(null)

let nextId = 0

interface State {
  current: Notification | null
  queue: Notification[]
  open: boolean
}

type Action =
  | { type: 'enqueue'; notification: Notification }
  | { type: 'close' }
  | { type: 'exited' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'enqueue': {
      if (state.current === null && !state.open) {
        return { current: action.notification, queue: state.queue, open: true }
      }
      return { ...state, queue: [...state.queue, action.notification] }
    }
    case 'close':
      return { ...state, open: false }
    case 'exited': {
      if (state.queue.length > 0) {
        const [next, ...rest] = state.queue
        return { current: next, queue: rest, open: true }
      }
      return { current: null, queue: [], open: false }
    }
    default:
      return state
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, {
    current: null,
    queue: [],
    open: false,
  })

  const enqueue = React.useCallback(
    (severity: NotifySeverity, message: string, options?: NotifyOptions) => {
      dispatch({
        type: 'enqueue',
        notification: {
          id: nextId++,
          severity,
          message,
          action: options?.action,
          durationMs: options?.durationMs,
        },
      })
    },
    []
  )

  const handleClose = React.useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === 'clickaway') return
      dispatch({ type: 'close' })
    },
    []
  )

  const handleExited = React.useCallback(() => {
    dispatch({ type: 'exited' })
  }, [])

  const api = React.useMemo<NotifyApi>(
    () => ({
      success: (message, options) => enqueue('success', message, options),
      error: (message, options) => enqueue('error', message, options),
      info: (message, options) => enqueue('info', message, options),
    }),
    [enqueue]
  )

  return (
    <NotifyContext.Provider value={api}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={state.current?.durationMs ?? TIEMPOS.TOAST_MS}
        onClose={handleClose}
        slots={{ transition: Slide }}
        slotProps={{
          transition: {
            direction: 'up',
            onExited: handleExited,
            timeout: {
              enter: MOTION.duraciones.media,
              exit: MOTION.duraciones.rapida,
            },
          } as never,
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{
          bottom: {
            xs: 'calc(80px + env(safe-area-inset-bottom, 0px)) !important',
            sm: '24px !important',
          },
          right: { sm: '24px !important' },
          left: { xs: '50% !important', sm: 'auto !important' },
          transform: { xs: 'translateX(-50%) !important', sm: 'none !important' },
          zIndex: (theme) => theme.zIndex.snackbar,
        }}
      >
        {state.current ? (
          <Box
            role={state.current.severity === 'error' ? 'alert' : 'status'}
            aria-live={state.current.severity === 'error' ? 'assertive' : 'polite'}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              minWidth: { xs: 280, sm: 320 },
              maxWidth: { xs: 'calc(100vw - 32px)', sm: 480 },
              py: 1.25,
              px: 2,
              borderRadius: '8px',
              bgcolor: 'brand.midnight',
              color: 'brand.onMidnight',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? SOMBRAS.oscuro.elevacion1
                  : SOMBRAS.claro.elevacion1,
              border: (theme) =>
                theme.palette.mode === 'dark'
                  ? '1px solid var(--mui-palette-dialogDivider, #2C3B55)'
                  : 'none',
            }}
          >
            {/* Ícono semántico */}
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color:
                  state.current.severity === 'success'
                    ? '#ABC7F1'
                    : state.current.severity === 'error'
                      ? '#EE8A83'
                      : '#9FB4D3',
              }}
            >
              {state.current.severity === 'success' ? (
                <CheckCircleOutlinedIcon fontSize="small" />
              ) : state.current.severity === 'error' ? (
                <ErrorOutlineOutlinedIcon fontSize="small" />
              ) : (
                <InfoOutlinedIcon fontSize="small" />
              )}
            </Box>

            {/* Mensaje */}
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                color: 'brand.onMidnight',
                fontWeight: 500,
                fontSize: '0.875rem',
                lineHeight: 1.4,
              }}
            >
              {state.current.message}
            </Typography>

            {/* Acción opcional ("Ver", "Deshacer") */}
            {state.current.action &&
              (state.current.action.href ? (
                <Button
                  component={Link}
                  href={state.current.action.href}
                  size="small"
                  onClick={() => {
                    state.current?.action?.onClick?.()
                    dispatch({ type: 'close' })
                  }}
                  sx={{
                    color: 'brand.brass',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    textTransform: 'none',
                    minWidth: 'auto',
                    px: 1,
                    py: 0.25,
                    '&:hover': {
                      bgcolor: 'rgba(201, 166, 107, 0.12)',
                    },
                  }}
                >
                  {state.current.action.label}
                </Button>
              ) : (
                <Button
                  size="small"
                  onClick={() => {
                    state.current?.action?.onClick?.()
                    dispatch({ type: 'close' })
                  }}
                  sx={{
                    color: 'brand.brass',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    textTransform: 'none',
                    minWidth: 'auto',
                    px: 1,
                    py: 0.25,
                    '&:hover': {
                      bgcolor: 'rgba(201, 166, 107, 0.12)',
                    },
                  }}
                >
                  {state.current.action.label}
                </Button>
              ))}

            {/* Botón cerrar */}
            <IconButton
              size="small"
              aria-label="Cerrar notificación"
              onClick={handleClose}
              sx={{
                color: 'brand.onMidnight',
                opacity: 0.7,
                p: 0.5,
                ml: state.current.action ? 0 : 0.5,
                flexShrink: 0,
                '&:hover': {
                  opacity: 1,
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : undefined}
      </Snackbar>
    </NotifyContext.Provider>
  )
}

export function useNotify(): NotifyApi {
  const ctx = React.useContext(NotifyContext)
  if (!ctx) {
    throw new Error('useNotify debe usarse dentro de <NotificationProvider>')
  }
  return ctx
}
