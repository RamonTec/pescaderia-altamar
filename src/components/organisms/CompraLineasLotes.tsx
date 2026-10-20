'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined'
import { FichaSeccion } from '@/components/molecules/FichaSeccion'
import { LoteChip } from '@/components/molecules/LoteChip'
import { EstadoChip } from '@/components/organisms/appDataGridColumns'
import { ESTADOS_LOTE } from '@/components/organisms/LotesTable'
import { formatMoneda } from '@/lib/compras/textos'
import { formatFecha, formatKg, formatUsd } from '@/lib/format'
import type { LineaCompraDetalle, Moneda } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

export interface CompraLineasLotesProps {
  lineas: readonly LineaCompraDetalle[]
  /** Moneda de la compra (costo pactado). */
  moneda: Moneda
}

function Dato({ label, valor, detalle }: { label: string; valor: string; detalle?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ ...NUM, fontWeight: 500 }}>
        {valor}
      </Typography>
      {detalle ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={NUM}>
          {detalle}
        </Typography>
      ) : null}
    </Box>
  )
}

/**
 * Líneas de una compra con su lote (19, solo admin): producto, `LoteChip`
 * (enlace a la ficha del lote) y estado, kg inicial → consumido (procesado /
 * vendido / perdido) → stock, costo/kg pactado y USD, subtotal. Si el lote se
 * procesó, lista compacta de sus lotes hijos con su costo/kg y kg vendidos.
 * Una línea sin control de stock no tiene lote.
 */
export function CompraLineasLotes({ lineas, moneda }: CompraLineasLotesProps) {
  return (
    <FichaSeccion titulo="Líneas y lotes">
      <Box sx={{ display: 'grid', gap: 2 }}>
        {lineas.map((l, i) => {
          const lote = l.lote
          const consumido = lote ? Math.max(Math.round((lote.peso_inicial_kg - lote.stock_kg) * 1000) / 1000, 0) : 0
          const desglose = lote
            ? [
                lote.kg_procesados > 0 ? `procesado ${formatKg(lote.kg_procesados)}` : null,
                lote.kg_vendidos > 0 ? `vendido ${formatKg(lote.kg_vendidos)}` : null,
                lote.kg_perdidos > 0 ? `perdido ${formatKg(lote.kg_perdidos)}` : null,
              ].filter(Boolean)
            : []
          const estado = lote ? ESTADOS_LOTE[lote.estado] : null
          return (
            <React.Fragment key={l.id}>
              {i > 0 ? <Divider /> : null}
              <Box component="article" sx={{ display: 'grid', gap: 1.5 }} aria-label={`Línea ${l.producto.nombre}`}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" component="h3">
                    {l.producto.nombre}
                  </Typography>
                  {lote ? (
                    <>
                      <LoteChip codigo={lote.codigo} href={`/inventario/lotes/${lote.id}`} />
                      {estado ? <EstadoChip label={estado.label} color={estado.color} /> : null}
                    </>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Sin control de stock
                    </Typography>
                  )}
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
                  }}
                >
                  <Dato
                    label="Kg"
                    valor={formatKg(l.peso_kg)}
                    detalle={lote ? `Consumido ${formatKg(consumido)} · stock ${formatKg(lote.stock_kg)}` : undefined}
                  />
                  <Dato
                    label={`Costo/kg (${moneda === 'bs' ? 'Bs' : 'USD'})`}
                    valor={formatMoneda(l.costo_kg_pactado, moneda)}
                    detalle={moneda === 'bs' ? `${formatUsd(l.costo_usd_kg)}/kg` : undefined}
                  />
                  <Dato label="Subtotal" valor={formatUsd(l.peso_kg * l.costo_usd_kg)} />
                  {lote ? (
                    <Dato
                      label="Primera salida"
                      valor={lote.primera_salida ? formatFecha(lote.primera_salida) : 'Sin salidas'}
                      detalle={desglose.length > 0 ? desglose.join(' · ') : undefined}
                    />
                  ) : null}
                </Box>

                {lote && lote.procesamientos.length > 0 ? (
                  <Box
                    sx={{ display: 'grid', gap: 1, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}
                    aria-label={`Procesados del lote ${lote.codigo}`}
                  >
                    {lote.procesamientos.map((pr) => (
                      <Box key={pr.id} sx={{ display: 'grid', gap: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ...NUM }}>
                          <ContentCutOutlinedIcon sx={{ fontSize: 16 }} aria-hidden />
                          Procesado el {formatFecha(pr.fecha)} · entrada {formatKg(pr.peso_entrada_kg)}
                          {pr.costo_total_usd != null ? ` · costo ${formatUsd(pr.costo_total_usd)}` : ''}
                        </Typography>
                        {pr.salidas.map((s) => (
                          <Box
                            key={s.proceso_item_id}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pl: { xs: 0, sm: 3 } }}
                          >
                            <Typography variant="body2" sx={{ minWidth: 120 }}>
                              {s.producto_nombre}
                            </Typography>
                            {s.lote ? <LoteChip codigo={s.lote.codigo} href={`/inventario/lotes/${s.lote.id}`} /> : null}
                            <Typography variant="body2" color="text.secondary" sx={NUM}>
                              {formatKg(s.peso_salida_kg)}
                              {s.lote ? ` · ${formatUsd(s.lote.costo_usd_kg)}/kg` : ` · ${formatUsd(s.costo_total_usd)}`}
                              {s.lote && s.lote.ventas.kg > 0 ? ` · vendido ${formatKg(s.lote.ventas.kg)}` : ''}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                ) : null}
              </Box>
            </React.Fragment>
          )
        })}
      </Box>
    </FichaSeccion>
  )
}
