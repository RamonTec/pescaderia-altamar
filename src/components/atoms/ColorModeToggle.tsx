'use client'

import * as React from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness'
import { useColorScheme } from '@mui/material/styles'

const CYCLE: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']

const LABELS: Record<'light' | 'dark' | 'system', string> = {
  light: 'Cambiar a modo oscuro',
  dark: 'Cambiar a modo del sistema',
  system: 'Cambiar a modo claro',
}

export function ColorModeToggle() {
  const { mode, setMode } = useColorScheme()

  const current: 'light' | 'dark' | 'system' = mode ?? 'system'
  const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]

  const Icon =
    current === 'light'
      ? LightModeIcon
      : current === 'dark'
        ? DarkModeIcon
        : SettingsBrightnessIcon

  return (
    <Tooltip title={LABELS[current]}>
      <IconButton
        aria-label={LABELS[current]}
        color="inherit"
        sx={{ color: 'text.secondary' }}
        onClick={() => setMode(next)}
      >
        <Icon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}
