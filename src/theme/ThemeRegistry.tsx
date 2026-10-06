'use client'

import * as React from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'

const options = { key: 'mui', prepend: true }

export function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = React.useState(() => {
    const cache = createCache(options)
    return { cache, flush: () => cache.sheet.tags }
  })

  useServerInsertedHTML(() => {
    const tags = flush()
    if (!tags.length) {
      return null
    }
    const styles = tags
      .map((tag) => {
        const key = tag.getAttribute('data-emotion')
        return `<style data-emotion="${key}">${tag.textContent}</style>`
      })
      .join('')
    return (
      <style
        data-emotion={`${options.key} global`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    )
  })

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  )
}
