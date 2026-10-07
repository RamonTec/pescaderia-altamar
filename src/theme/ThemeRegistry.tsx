'use client'

import * as React from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import { themeStorageManager } from '@/lib/themeStorage'

const options = { key: 'mui', prepend: true }

export function ThemeRegistry({ children }: { children: React.ReactNode }) {
  // Patrón de MUI para App Router: `compat` evita que emotion renderice
  // <style> inline durante SSR (rompía la hidratación); los estilos
  // insertados se registran y se emiten en el <head> vía useServerInsertedHTML.
  const [{ cache, flush }] = React.useState(() => {
    const cache = createCache(options)
    cache.compat = true
    const prevInsert = cache.insert
    let inserted: { name: string; isGlobal: boolean }[] = []
    cache.insert = (...args) => {
      const [selector, serialized] = args
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push({ name: serialized.name, isGlobal: !selector })
      }
      return prevInsert(...args)
    }
    const flush = () => {
      const prev = inserted
      inserted = []
      return prev
    }
    return { cache, flush }
  })

  useServerInsertedHTML(() => {
    const names = flush()
    if (names.length === 0) {
      return null
    }
    let styles = ''
    let dataEmotionAttribute = cache.key
    const globals: { name: string; style: string }[] = []

    names.forEach(({ name, isGlobal }) => {
      const style = cache.inserted[name]
      if (typeof style !== 'string') return
      if (isGlobal) {
        globals.push({ name, style })
      } else {
        styles += style
        dataEmotionAttribute += ` ${name}`
      }
    })

    return (
      <>
        {globals.map(({ name, style }) => (
          <style
            key={name}
            data-emotion={`${cache.key}-global ${name}`}
            dangerouslySetInnerHTML={{ __html: style }}
          />
        ))}
        {styles && (
          <style data-emotion={dataEmotionAttribute} dangerouslySetInnerHTML={{ __html: styles }} />
        )}
      </>
    )
  })

  return (
    <CacheProvider value={cache}>
      <ThemeProvider
        theme={theme}
        defaultMode="system"
        storageManager={themeStorageManager}
        disableTransitionOnChange
      >
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  )
}
