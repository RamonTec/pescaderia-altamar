'use client'

import * as React from 'react'
import Alert, { type AlertColor } from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

export type NotifySeverity = Exclude<AlertColor, 'warning'>

interface Notification {
  id: number
  severity: NotifySeverity
  message: string
}

export interface NotifyApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
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

  const enqueue = React.useCallback((severity: NotifySeverity, message: string) => {
    dispatch({ type: 'enqueue', notification: { id: nextId++, severity, message } })
  }, [])

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
      success: (message) => enqueue('success', message),
      error: (message) => enqueue('error', message),
      info: (message) => enqueue('info', message),
    }),
    [enqueue]
  )

  return (
    <NotifyContext.Provider value={api}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={5000}
        onClose={handleClose}
        slotProps={{ transition: { onExited: handleExited } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {state.current ? (
          <Alert
            severity={state.current.severity}
            variant="filled"
            onClose={handleClose}
            sx={{ width: '100%' }}
          >
            {state.current.message}
          </Alert>
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
