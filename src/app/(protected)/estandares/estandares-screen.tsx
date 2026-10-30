'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import Link from '@mui/material/Link'
import Switch from '@mui/material/Switch'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { PageHeader } from '@/components/molecules/PageHeader'
import { useNotify } from '@/lib/useNotify'
import { AnclasContext } from './secciones/comun'
import { Fundamentos } from './secciones/Fundamentos'
import { Primitivos } from './secciones/Primitivos'
import { Patrones } from './secciones/Patrones'
import { CargaFeedback } from './secciones/CargaFeedback'
import { Fallbacks } from './secciones/Fallbacks'
import { Dashboard } from './secciones/Dashboard'

const SECCIONES = [
  { id: 'fundamentos', titulo: 'Fundamentos', Componente: Fundamentos },
  { id: 'primitivos', titulo: 'Primitivos', Componente: Primitivos },
  { id: 'patrones', titulo: 'Patrones', Componente: Patrones },
  { id: 'carga', titulo: 'Carga y feedback', Componente: CargaFeedback },
  { id: 'fallbacks', titulo: 'Fallbacks', Componente: Fallbacks },
  { id: 'dashboard', titulo: 'Dashboard', Componente: Dashboard },
] as const

function Contenido() {
  return (
    <Box sx={{ display: 'grid', gap: 8, minWidth: 0 }}>
      {SECCIONES.map(({ id, Componente }) => (
        <Componente key={id} />
      ))}
    </Box>
  )
}

/**
 * Un esquema de color aplicado a un contenedor: MUI define las variables en
 * `:root, [data-mui-color-scheme="light"]` y `[data-mui-color-scheme="dark"]`
 * (verificado con `theme.generateStyleSheets()`), así que el atributo anidado
 * redefine los tokens de todo lo que hay dentro.
 */
function Esquema({ modo, children }: { modo: 'light' | 'dark'; children: React.ReactNode }) {
  return (
    <Box
      data-mui-color-scheme={modo}
      sx={{
        colorScheme: modo,
        bgcolor: 'background.default',
        color: 'text.primary',
        p: { xs: 2, md: 3 },
        borderRadius: '8px',
        border: 1,
        borderColor: 'divider',
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  )
}

/**
 * Catálogo vivo del design system (spec § Design system, Fase 4f): cada
 * fundamento, primitivo, patrón, carga, feedback y fallback con sus estados.
 * Solo en desarrollo y para administradores (`page.tsx`).
 */
export function EstandaresScreen() {
  const notify = useNotify()
  const [ambos, setAmbos] = React.useState(false)

  return (
    <>
      <PageHeader
        title="Estándares UI"
        subtitle="Catálogo vivo del design system Altamar. Revisa claro, oscuro y 375 px."
        primaryAction={{
          label: 'Nuevo cliente',
          icon: <AddOutlinedIcon />,
          onClick: () => notify.info('Acción principal (Fab en xs)'),
        }}
        secondaryActions={[
          {
            label: 'Exportar',
            icon: <FileDownloadOutlinedIcon />,
            onClick: () => notify.info('Acción secundaria (menú ⋮ en xs)'),
          },
        ]}
      />

      <Box
        component="nav"
        aria-label="Índice del catálogo"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 3,
          rowGap: 1,
          mb: 6,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {SECCIONES.map(({ id, titulo }) => (
          <Link key={id} href={`#${id}`} variant="body2" underline="hover" color="text.primary">
            {titulo}
          </Link>
        ))}
        <Box sx={{ flexGrow: 1 }} />
        <FormControlLabel
          control={<Switch checked={ambos} onChange={(e) => setAmbos(e.target.checked)} />}
          label="Ambos modos"
        />
      </Box>

      <Box sx={{ pb: { xs: 10, sm: 0 } }}>
        {ambos ? (
          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            <Esquema modo="light">
              <Contenido />
            </Esquema>
            <AnclasContext.Provider value={false}>
              <Esquema modo="dark">
                <Contenido />
              </Esquema>
            </AnclasContext.Provider>
          </Box>
        ) : (
          <Contenido />
        )}
      </Box>
    </>
  )
}
