'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * Piezas compartidas del catálogo vivo (`/estandares`, 00-estandares-ui 4f):
 * secciones con ancla, tarjetas de demo y datos de muestra ficticios.
 */

/**
 * Con «Ambos modos» el catálogo se renderiza dos veces (claro y oscuro): solo
 * la primera copia lleva los `id` de las anclas del índice.
 */
export const AnclasContext = React.createContext(true)

export function Seccion({
  id,
  titulo,
  descripcion,
  children,
}: {
  id: string
  titulo: string
  descripcion?: React.ReactNode
  children: React.ReactNode
}) {
  const conAncla = React.useContext(AnclasContext)
  return (
    <Box
      component="section"
      id={conAncla ? id : undefined}
      sx={{ display: 'grid', gap: 3, scrollMarginTop: 80, minWidth: 0 }}
    >
      <Box sx={{ pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h5" component="h2">
          {titulo}
        </Typography>
        {descripcion ? (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch', mt: 0.5 }}>
            {descripcion}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Box>
  )
}

/** Subtítulo dentro de una sección ("Superficies por nivel"). */
export function Apartado({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <Typography variant="sectionTitle" component="h3">
        {titulo}
      </Typography>
      {children}
    </Box>
  )
}

/** Tarjeta de una demo: superficie de nivel 0 con su etiqueta. */
export function Demo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        display: 'grid',
        gap: 1.5,
        alignContent: 'start',
        minWidth: 0,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '8px',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Box>
  )
}

/** Grilla de demos: 1 columna en `xs`, `columnas` desde `md`. */
export function Demos({ columnas = 2, children }: { columnas?: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: `repeat(${columnas}, minmax(0, 1fr))` },
      }}
    >
      {children}
    </Box>
  )
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---------- datos de muestra (ficticios) ---------- */

export interface ClienteDemo {
  id: number
  nombre: string
  rif: string
  telefono: string
  limite: number | null
  saldo: number
  estado: 'activo' | 'bloqueado' | 'inactivo'
  alta: string
}

const NOMBRES = [
  'Restaurante El Muelle',
  'Hotel Bahía Azul',
  'Marisquería Los Roques',
  'Pescadería Margarita',
  'Supermercado El Faro',
  'Doña María',
  'Posada La Ensenada',
  'Club Náutico Puerto Azul',
]

export const CLIENTES: ClienteDemo[] = Array.from({ length: 64 }, (_, i) => ({
  id: i + 1,
  nombre: `${NOMBRES[i % NOMBRES.length]}${i >= NOMBRES.length ? ` ${Math.floor(i / NOMBRES.length) + 1}` : ''}`,
  rif: `J-${String(30000000 + i * 7919).slice(0, 8)}-${i % 10}`,
  telefono: `0414-${String(5550000 + i * 13).slice(0, 7)}`,
  limite: i % 5 === 4 ? null : 500 + ((i * 375) % 5000),
  saldo: i % 3 === 0 ? 0 : (i * 137.5) % 2400,
  estado: i % 9 === 2 ? 'bloqueado' : i % 11 === 6 ? 'inactivo' : 'activo',
  alta: `2026-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
}))

/** Solo las excepciones llevan chip (principio 2): «Activo» va sin color. */
export const ESTADOS_CLIENTE = {
  activo: { label: 'Activo', color: 'default' },
  bloqueado: { label: 'Bloqueado', color: 'error' },
  inactivo: { label: 'Inactivo', color: 'default' },
} as const
