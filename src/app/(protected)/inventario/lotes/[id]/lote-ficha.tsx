'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined'
import { useTheme } from '@mui/material/styles'
import { CopyableText } from '@/components/molecules/CopyableText'
import { FichaHeader } from '@/components/molecules/FichaHeader'
import { FichaDato, FichaDatos, FichaSeccion } from '@/components/molecules/FichaSeccion'
import { LoteChip } from '@/components/molecules/LoteChip'
import { EstadoChip } from '@/components/organisms/appDataGridColumns'
import { ESTADOS_LOTE } from '@/components/organisms/LotesTable'
import { LoteTimeline } from '@/components/organisms/LoteTimeline'
import { ResultadoLoteCard } from '@/components/organisms/ResultadoLoteCard'
import { diasEnCava, esAntiguo, porcentajeRestante } from '@/lib/lotes'
import { formatBs, formatFecha, formatKg, formatTasa, formatUsd } from '@/lib/format'
import type { ResultadoLote, TrazabilidadLote } from '@/types/domain'
import { useLoteAcciones } from '../../useLoteAcciones'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

export interface LoteFichaProps {
  traza: TrazabilidadLote
  /** Solo admin; `null` para el operador. */
  resultado: ResultadoLote | null
  esAdmin: boolean
  diasAlertaLote: number | null
}

/**
 * Ficha de un lote (07-lotes): código grande copiable, producto, proveedor,
 * estado, días en cava y kg restantes; árbol padre/hijos con enlaces; línea
 * de tiempo; saldo por lote y resultado (solo admin). Acciones: registrar
 * pérdida y cerrar el lote (con confirmación de los kg).
 */
export function LoteFicha({ traza, resultado, esAdmin, diasAlertaLote }: LoteFichaProps) {
  const router = useRouter()
  const theme = useTheme()
  const { lote, arbol } = traza
  const { acciones, dialogos, registrarPerdida, estaPendiente } = useLoteAcciones({
    onCambio: () => router.refresh(),
    conTrazabilidad: false,
  })
  const config = { dias_alerta_lote: diasAlertaLote }
  const dias = diasEnCava(lote)
  const hijos = arbol.filter((l) => l.lote_padre_id === lote.id)
  const estado = ESTADOS_LOTE[lote.estado]
  const puedePerder = lote.estado === 'abierto' && lote.stock_kg > 0
  const menu = acciones(lote).filter((a) => a.label !== 'Registrar pérdida')

  return (
    <Fade in timeout={theme.transitions.duration.short}>
      <Box sx={{ display: 'grid', gap: 3 }}>
        <FichaHeader
          backHref="/inventario?tab=lotes"
          backLabel="Inventario"
          title={lote.codigo}
          meta={
            <>
              <CopyableText value={lote.codigo} copiedMessage={`Código ${lote.codigo} copiado`} />
              <span>{lote.producto_nombre}</span>
              {lote.proveedor_nombre ? <span>{lote.proveedor_nombre}</span> : null}
              <EstadoChip label={estado.label} color={estado.color} />
              {esAntiguo(lote, config) ? <EstadoChip label="Antiguo" color="warning" /> : null}
            </>
          }
          primaryAction={
            puedePerder
              ? {
                  label: 'Registrar pérdida',
                  icon: <RemoveCircleOutlineOutlinedIcon />,
                  onClick: () => registrarPerdida(lote),
                }
              : undefined
          }
          menuActions={menu}
          pending={estaPendiente(lote.id)}
        />

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'grid', gap: 3 }}>
            <FichaSeccion titulo="Lote">
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                <Typography variant="h5" component="p" sx={NUM}>
                  {formatKg(lote.stock_kg)}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}
                    de {formatKg(lote.peso_inicial_kg)}
                  </Typography>
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={porcentajeRestante(lote)}
                  aria-label={`Queda ${Math.round(porcentajeRestante(lote))} %`}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
              <FichaDatos>
                <FichaDato label="Ingreso">
                  {formatFecha(lote.fecha_ingreso)} · {dias} {dias === 1 ? 'día' : 'días'} en cava
                </FichaDato>
                <FichaDato label="Origen">
                  {lote.origen === 'compra'
                    ? 'Compra'
                    : lote.origen === 'proceso'
                      ? 'Procesamiento'
                      : 'Inventario inicial'}
                </FichaDato>
                {lote.lote_padre_id ? (
                  <FichaDato label="Lote padre">
                    <LoteChip
                      codigo={lote.lote_padre_codigo ?? 'Padre'}
                      href={`/inventario/lotes/${lote.lote_padre_id}`}
                    />
                  </FichaDato>
                ) : null}
                {hijos.length > 0 ? (
                  <FichaDato label="Lotes procesados">
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {hijos.map((h) => (
                        <LoteChip
                          key={h.id}
                          codigo={h.codigo}
                          pesoKg={h.stock_kg}
                          href={`/inventario/lotes/${h.id}`}
                        />
                      ))}
                    </Box>
                  </FichaDato>
                ) : null}
                <FichaDato label="Tasa de compra">
                  {formatTasa(lote.tasa_snapshot)} · moneda {lote.moneda.toUpperCase()}
                </FichaDato>
                {esAdmin && lote.costo_usd_kg != null ? (
                  <FichaDato label="Costo/kg">{formatUsd(lote.costo_usd_kg)}</FichaDato>
                ) : null}
              </FichaDatos>
            </FichaSeccion>

            <FichaSeccion titulo="Historia">
              <LoteTimeline traza={traza} esAdmin={esAdmin} />
            </FichaSeccion>
          </Box>

          <Box sx={{ display: 'grid', gap: 3 }}>
            {esAdmin && resultado ? (
              <ResultadoLoteCard
                resultado={resultado}
                tasaCompra={lote.tasa_snapshot}
                consolidado={hijos.length > 0}
              />
            ) : null}

            <FichaSeccion titulo="Saldo">
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
                {arbol.map((l) => (
                  <Box
                    component="li"
                    key={l.id}
                    sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {l.codigo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {l.producto_nombre} · {ESTADOS_LOTE[l.estado].label}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={NUM}>
                        {formatKg(l.stock_kg)}
                      </Typography>
                      {esAdmin && l.costo_usd_kg != null ? (
                        <Typography variant="caption" color="text.secondary" sx={NUM}>
                          {formatUsd(l.stock_kg * l.costo_usd_kg)} ·{' '}
                          {formatBs(l.stock_kg * l.costo_usd_kg * l.tasa_snapshot)} a tasa de compra
                        </Typography>
                      ) : null}
                    </Box>
                  </Box>
                ))}
              </Box>
            </FichaSeccion>
          </Box>
        </Box>

        {dialogos}
      </Box>
    </Fade>
  )
}
