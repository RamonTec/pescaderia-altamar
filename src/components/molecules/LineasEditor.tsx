'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { TransitionGroup } from 'react-transition-group'

export interface LineasEditorColumna {
  key: string
  /** Encabezado de la columna; en `xs`, cada campo muestra su propia etiqueta. */
  label: string
  /** Pista de la grilla: número en px o valor CSS (`'2fr'`, `'minmax(0, 1fr)'`). */
  width: number | string
  align?: 'left' | 'right'
}

export interface LineasEditorProps<F> {
  columnas: readonly LineasEditorColumna[]
  filas: readonly F[]
  /** El campo de una celda. Conserva su `label`: el editor la oculta a la vista en `sm+`. */
  renderCelda: (fila: F, columna: LineasEditorColumna, index: number) => React.ReactNode
  onAgregar: () => void
  onQuitar: (index: number) => void
  agregarLabel?: string
  disabled?: boolean
  /** Totales a la derecha, bajo un divisor. */
  totales?: React.ReactNode
  /** Clave estable de la fila (por defecto `fila.id`, el de `useFieldArray`). */
  getKey?: (fila: F, index: number) => React.Key
}

// Oculto a la vista y presente para el lector de pantalla.
const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const

const PAPELERA = 36
const ALTO_CAMPO = 40

function pista(width: number | string) {
  return typeof width === 'number' ? `${width}px` : width
}

/**
 * Líneas repetibles de un formulario (spec § Design system › Patrones ›
 * Formulario). Es solo disposición: el consumidor trae `useFieldArray` y
 * renderiza cada campo con su `label`.
 *
 * - `sm+`: una fila de encabezados y las líneas en grilla, sin cajas
 *   anidadas; la etiqueta de cada campo queda oculta a la vista pero sigue
 *   siendo su nombre accesible. Papelera de 36 px alineada al campo.
 * - `xs`: cada línea es un bloque con sus etiquetas y la papelera arriba a
 *   la derecha.
 * - "Agregar línea" como botón de texto debajo; totales a la derecha bajo un
 *   divisor; `Collapse` al agregar y al quitar.
 */
export function LineasEditor<F>({
  columnas,
  filas,
  renderCelda,
  onAgregar,
  onQuitar,
  agregarLabel = 'Agregar línea',
  disabled = false,
  totales,
  getKey = (fila, index) => (fila as { id?: React.Key }).id ?? index,
}: LineasEditorProps<F>) {
  const template = `${columnas.map((c) => pista(c.width)).join(' ')} ${PAPELERA}px`
  const grilla = {
    display: { xs: 'block', sm: 'grid' },
    gridTemplateColumns: { sm: template },
    columnGap: 2,
  } as const

  return (
    <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      {filas.length > 0 ? (
        <Box aria-hidden sx={{ ...grilla, display: { xs: 'none', sm: 'grid' } }}>
          {columnas.map((c) => (
            <Typography
              key={c.key}
              variant="label"
              color="text.secondary"
              sx={{ textAlign: c.align ?? 'left' }}
            >
              {c.label}
            </Typography>
          ))}
        </Box>
      ) : null}

      <TransitionGroup component={null}>
        {filas.map((fila, index) => (
          <Collapse key={getKey(fila, index)}>
            <Box
              role="group"
              aria-label={`Línea ${index + 1}`}
              sx={(t) => ({
                ...grilla,
                position: 'relative',
                alignItems: 'start',
                [t.breakpoints.down('sm')]: {
                  py: 2,
                  pr: `${PAPELERA + 8}px`,
                  borderTop: 1,
                  borderColor: 'rowDivider',
                  '& > [data-celda] + [data-celda]': { mt: 3 },
                },
                [t.breakpoints.up('sm')]: {
                  pb: 2,
                  '& [data-celda] .MuiInputLabel-root, & [data-celda] .MuiFormLabel-root':
                    visuallyHidden,
                },
              })}
            >
              {columnas.map((c) => (
                <Box key={c.key} data-celda sx={{ minWidth: 0, textAlign: c.align ?? 'left' }}>
                  {renderCelda(fila, c, index)}
                </Box>
              ))}
              <IconButton
                aria-label={`Quitar línea ${index + 1}`}
                disabled={disabled}
                onClick={() => onQuitar(index)}
                sx={(t) => ({
                  width: PAPELERA,
                  height: PAPELERA,
                  color: 'text.secondary',
                  [t.breakpoints.up('sm')]: { mt: `${(ALTO_CAMPO - PAPELERA) / 2}px` },
                  [t.breakpoints.down('sm')]: { position: 'absolute', top: 8, right: 0 },
                })}
              >
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Box>
          </Collapse>
        ))}
      </TransitionGroup>

      <Box>
        <Button variant="text" startIcon={<AddIcon />} disabled={disabled} onClick={onAgregar}>
          {agregarLabel}
        </Button>
      </Box>

      {totales ? (
        <Box
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            '.MuiDialog-paper &': { borderColor: 'dialogDivider' },
            pt: 2,
            display: 'flex',
            justifyContent: 'flex-end',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {totales}
        </Box>
      ) : null}
    </Box>
  )
}
