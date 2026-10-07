'use client'

import * as React from 'react'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<ConfirmOptions>({ title: '' })
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null)

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const handleClose = React.useCallback((result: boolean) => {
    setOpen(false)
    resolverRef.current?.(result)
    resolverRef.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={open}
        title={options.title}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        destructive={options.destructive}
        onConfirm={() => handleClose(true)}
        onCancel={() => handleClose(false)}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  }
  return ctx.confirm
}
