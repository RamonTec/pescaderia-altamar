'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'

export interface FilaResumen {
  id: string
  /** Línea principal (nombre del cliente, número de contrato). */
  primary: React.ReactNode
  /** Línea secundaria en `caption`. */
  secondary?: React.ReactNode
  /** Monto o cifra a la derecha (ya formateada), tabular. */
  amount?: React.ReactNode
  /** Detalle bajo el monto (`caption`). */
  amountDetail?: React.ReactNode
  /** Chip de estado, a la derecha. */
  status?: React.ReactNode
  /** Si la fila enlaza a una ficha o listado. */
  href?: string
}

/**
 * Lista compacta de un resumen (15-dashboard: deudores, clientes inactivos,
 * contratos): principal + secundaria a la izquierda, monto tabular y estado a
 * la derecha. Filas de ≥ 56 px (táctil en `xs`); con `href`, toda la fila es
 * un enlace.
 */
export function ListaResumen({ filas, ariaLabel }: { filas: readonly FilaResumen[]; ariaLabel: string }) {
  return (
    <List disablePadding aria-label={ariaLabel}>
      {filas.map((f, i) => {
        const contenido = (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', minHeight: 56, py: 0.75 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                {f.primary}
              </Typography>
              {f.secondary ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="p"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {f.secondary}
                </Typography>
              ) : null}
            </Box>
            {f.amount !== undefined ? (
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {f.amount}
                </Typography>
                {f.amountDetail ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                    sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                  >
                    {f.amountDetail}
                  </Typography>
                ) : null}
              </Box>
            ) : null}
            {f.status ? <Box sx={{ flexShrink: 0 }}>{f.status}</Box> : null}
          </Box>
        )
        return (
          <ListItem key={f.id} disablePadding divider={i < filas.length - 1}>
            {f.href ? (
              <ListItemButton component={Link} href={f.href} sx={{ px: 1 }}>
                {contenido}
              </ListItemButton>
            ) : (
              <Box sx={{ px: 1, width: '100%' }}>{contenido}</Box>
            )}
          </ListItem>
        )
      })}
    </List>
  )
}
