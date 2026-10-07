'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Switch from '@mui/material/Switch'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import KeyboardArrowDownOutlinedIcon from '@mui/icons-material/KeyboardArrowDownOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { EmptyState } from '@/components/molecules/EmptyState'
import { LoteChip } from '@/components/molecules/LoteChip'
import { diasEnCava, esAntiguo } from '@/lib/lotes'
import { formatBs, formatFecha, formatKg, formatUsd } from '@/lib/format'
import type { InventarioProducto } from '@/lib/services/costingService'

const NUM = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

export interface InventarioProductosTableProps {
  items: InventarioProducto[]
  diasAlertaLote: number | null
  esAdmin: boolean
  totalUsd: number | null
  totalBs: number | null
}

/**
 * Pestaña Productos de `/inventario` (07-lotes): kg en stock (Σ de sus
 * lotes), lotes abiertos, lote más antiguo y alerta de stock bajo; costo
 * promedio informativo y valor USD/Bs solo para admin. Cada fila se expande
 * (`Collapse`) con sus lotes. Tabla MUI y no `AppDataGrid`: la grilla
 * gratuita no tiene filas expandibles (detail panel es de la versión Pro).
 */
export function InventarioProductosTable({
  items,
  diasAlertaLote,
  esAdmin,
  totalUsd,
  totalBs,
}: InventarioProductosTableProps) {
  const theme = useTheme()
  const compacto = useMediaQuery(theme.breakpoints.down('md'))
  const [soloConStock, setSoloConStock] = React.useState(true)
  const [abiertos, setAbiertos] = React.useState<ReadonlySet<string>>(() => new Set())
  const config = { dias_alerta_lote: diasAlertaLote }

  const filas = soloConStock ? items.filter((i) => i.stock_kg > 0) : items
  const alternar = (id: string) =>
    setAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const columnas = 4 + (compacto ? 0 : 1) + (esAdmin ? (compacto ? 1 : 3) : 0)

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
        <FormControlLabel
          control={
            <Switch checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)} />
          }
          label="Solo con stock"
        />
        <Box sx={{ flex: 1 }} />
        {esAdmin && totalUsd != null ? (
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">
              Valor del inventario
            </Typography>
            <Typography variant="h6" sx={NUM}>
              {formatUsd(totalUsd)}
              {totalBs != null ? (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {formatBs(totalBs)}
                </Typography>
              ) : null}
            </Typography>
          </Box>
        ) : null}
      </Box>

      {filas.length === 0 ? (
        <EmptyState
          icon={<Inventory2OutlinedIcon fontSize="large" />}
          title={soloConStock ? 'No hay stock en lotes' : 'No hay productos activos'}
          description={
            soloConStock
              ? 'Cada compra crea un lote por línea. Registra una compra para empezar.'
              : 'Crea productos en Catálogos.'
          }
        />
      ) : (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Stock por producto">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 48 }} />
                <TableCell>Producto</TableCell>
                <TableCell align="right">En stock</TableCell>
                {!compacto ? <TableCell align="right">Lotes</TableCell> : null}
                <TableCell>Más antiguo</TableCell>
                {esAdmin && !compacto ? <TableCell align="right">Costo prom./kg</TableCell> : null}
                {esAdmin ? <TableCell align="right">Valor USD</TableCell> : null}
                {esAdmin && !compacto ? <TableCell align="right">Valor Bs</TableCell> : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {filas.map((i) => {
                const abierto = abiertos.has(i.producto.id)
                const masAntiguo = i.lotes[0]
                const dias = masAntiguo ? diasEnCava(masAntiguo) : null
                return (
                  <React.Fragment key={i.producto.id}>
                    <TableRow
                      hover
                      onClick={() => i.lotes.length > 0 && alternar(i.producto.id)}
                      sx={{
                        cursor: i.lotes.length > 0 ? 'pointer' : 'default',
                        '& > td': { borderBottom: abierto ? 'none' : undefined },
                      }}
                    >
                      <TableCell>
                        {i.lotes.length > 0 ? (
                          <IconButton
                            size="small"
                            aria-label={`${abierto ? 'Ocultar' : 'Ver'} lotes de ${i.producto.nombre}`}
                            aria-expanded={abierto}
                            onClick={(e) => {
                              e.stopPropagation()
                              alternar(i.producto.id)
                            }}
                          >
                            <KeyboardArrowDownOutlinedIcon
                              fontSize="small"
                              sx={{
                                transform: abierto ? 'rotate(180deg)' : 'none',
                                transition: theme.transitions.create('transform', {
                                  duration: theme.transitions.duration.short,
                                }),
                              }}
                            />
                          </IconButton>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{i.producto.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[i.producto.codigo, i.producto.tipo === 'crudo' ? 'Crudo' : 'Procesado']
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'grid', justifyItems: 'end', gap: 0.25 }}>
                          <Typography variant="body2" sx={NUM}>
                            {i.producto.controla_stock ? formatKg(i.stock_kg) : '—'}
                          </Typography>
                          {i.stock_bajo ? (
                            <Chip size="small" variant="soft" color="warning" label="Stock bajo" />
                          ) : null}
                        </Box>
                      </TableCell>
                      {!compacto ? (
                        <TableCell align="right" sx={NUM}>
                          {i.lotes.length}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        {masAntiguo && dias != null ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={NUM}>
                              {dias} {dias === 1 ? 'día' : 'días'}
                            </Typography>
                            {esAntiguo(masAntiguo, config) ? (
                              <Chip size="small" variant="soft" color="warning" label="Antiguo" />
                            ) : null}
                          </Box>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      {esAdmin && !compacto ? (
                        <TableCell align="right" sx={NUM}>
                          {i.costo_promedio_usd_kg != null ? formatUsd(i.costo_promedio_usd_kg) : '—'}
                        </TableCell>
                      ) : null}
                      {esAdmin ? (
                        <TableCell align="right" sx={NUM}>
                          {i.valor_usd != null ? formatUsd(i.valor_usd) : '—'}
                        </TableCell>
                      ) : null}
                      {esAdmin && !compacto ? (
                        <TableCell align="right" sx={NUM}>
                          {i.valor_bs != null ? formatBs(i.valor_bs) : '—'}
                        </TableCell>
                      ) : null}
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={columnas} sx={{ py: 0, ...(abierto ? {} : { borderBottom: 'none' }) }}>
                        <Collapse in={abierto} timeout="auto" unmountOnExit>
                          <Box
                            component="ul"
                            sx={{ listStyle: 'none', m: 0, px: 0, py: 1.5, display: 'grid', gap: 1 }}
                          >
                            {i.lotes.map((l) => {
                              const d = diasEnCava(l)
                              return (
                                <Box
                                  component="li"
                                  key={l.id}
                                  sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    columnGap: 2,
                                    rowGap: 0.5,
                                  }}
                                >
                                  <LoteChip
                                    codigo={l.codigo}
                                    pesoKg={l.stock_kg}
                                    antiguo={esAntiguo(l, config)}
                                    dias={d}
                                    href={`/inventario/lotes/${l.id}`}
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    Ingresó {formatFecha(l.fecha_ingreso)} · {d} {d === 1 ? 'día' : 'días'}
                                    {l.proveedor_nombre ? ` · ${l.proveedor_nombre}` : ''}
                                    {esAdmin && l.costo_usd_kg != null
                                      ? ` · ${formatUsd(l.costo_usd_kg)}/kg`
                                      : ''}
                                  </Typography>
                                </Box>
                              )
                            })}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  )
}
