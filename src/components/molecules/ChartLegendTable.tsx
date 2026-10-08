'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'

/** Oculto a la vista y visible para lectores de pantalla. */
const VISUALLY_HIDDEN: React.CSSProperties = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
}

export interface ChartLegendColumn<R> {
  key: string
  label: string
  /** Montos, kg y porcentajes a la derecha. */
  align?: 'left' | 'right'
  /** Valor a mostrar (ya formateado con `lib/format.ts`). */
  render: (row: R) => React.ReactNode
}

export interface ChartLegendTableProps<R> {
  /** Descripción de la tabla (caption para lectores de pantalla). */
  caption: string
  columns: ChartLegendColumn<R>[]
  rows: readonly R[]
  getRowKey: (row: R, index: number) => string
  /**
   * `collapsible` (por defecto): botón "Ver tabla" que la despliega.
   * `hidden`: solo para lectores de pantalla.
   */
  variant?: 'collapsible' | 'hidden'
}

/**
 * Alternativa accesible a un gráfico (15-dashboard): los mismos datos en una
 * tabla. Colapsable bajo el gráfico o visualmente oculta. Cifras tabulares
 * (las aplica el theme en `MuiTableCell`) y números a la derecha.
 */
export function ChartLegendTable<R>({
  caption,
  columns,
  rows,
  getRowKey,
  variant = 'collapsible',
}: ChartLegendTableProps<R>) {
  const [abierta, setAbierta] = React.useState(false)
  const id = React.useId()

  const tabla = (
    <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
      <Table size="small" aria-label={caption}>
        <caption style={VISUALLY_HIDDEN}>{caption}</caption>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c.key} align={c.align ?? 'left'}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={getRowKey(r, i)}>
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align ?? 'left'} sx={{ whiteSpace: 'nowrap' }}>
                  {c.render(r)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )

  if (variant === 'hidden') {
    return <Box style={VISUALLY_HIDDEN}>{tabla}</Box>
  }

  return (
    <Box>
      <Button
        size="small"
        variant="text"
        startIcon={<TableChartOutlinedIcon />}
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((v) => !v)}
      >
        {abierta ? 'Ocultar tabla' : 'Ver tabla'}
      </Button>
      <Collapse in={abierta} id={id} unmountOnExit={false}>
        <Box sx={{ pt: 1 }}>{tabla}</Box>
      </Collapse>
    </Box>
  )
}
