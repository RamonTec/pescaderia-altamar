'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export interface PageHeaderProps {
  title: string
  children?: React.ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 1.5,
        mb: 3,
      }}
    >
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      {children ? (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{children}</Box>
      ) : null}
    </Box>
  )
}
