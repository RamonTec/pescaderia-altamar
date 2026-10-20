'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { NivelSenalChip } from '@/components/atoms/SenalFacturaChip'
import { FichaSeccion } from '@/components/molecules/FichaSeccion'
import { textoConteoSenales } from '@/lib/facturas/senales'
import { etiquetaIva, facturaConIva, formatIvaPct } from '@/lib/facturas/iva'
import { formatBs, formatPct, formatTasa, formatUsd } from '@/lib/format'
import type { DetalleFactura } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

export interface FacturaTotalesCardProps {
  detalle: DetalleFactura
  /** `config_negocio.iva_pct` vigente: el que aplica «Aplicar IVA» (18). */
  ivaPctConfig?: number
  /** Abre `CambiarIvaFacturaDialog` (18); sin él no se muestra la acción. */
  onCambiarIva?: () => void
}

interface Fila {
  label: string
  usd: number
  /** Resaltado (total, saldo). */
  fuerte?: boolean
  color?: string
  nota?: string
}

/**
 * Resumen de una factura (17, solo admin): subtotal, IVA, total, abonado,
 * notas de crédito y saldo (o saldo a favor del cliente, en verde), en USD y
 * en Bs a la tasa de la factura; margen neto y nivel de señales.
 * 18-iva-opcional: «Sin IVA» si `iva_pct = 0` y acción secundaria «Quitar
 * IVA» / «Aplicar IVA (16 %)», deshabilitada con tooltip si está anulada.
 */
export function FacturaTotalesCard({ detalle, ivaPctConfig, onCambiarIva }: FacturaTotalesCardProps) {
  const { factura, saldo, margen, senales } = detalle
  const tasa = factura.tasa_snapshot
  const filas: Fila[] = [
    { label: 'Subtotal', usd: factura.subtotal_usd },
    { label: etiquetaIva(factura.iva_pct), usd: factura.iva_usd },
    { label: 'Total', usd: factura.total_usd, fuerte: true },
    { label: 'Abonado', usd: factura.pagado_usd },
  ]
  if (saldo.creditos_usd > 0) filas.push({ label: 'Notas de crédito', usd: saldo.creditos_usd })
  if (saldo.saldo_a_favor_usd > 0) {
    filas.push({
      label: 'Saldo a favor',
      usd: saldo.saldo_a_favor_usd,
      fuerte: true,
      color: 'success.main',
      nota: 'a favor del cliente',
    })
  } else {
    filas.push({ label: 'Saldo', usd: saldo.saldo_usd, fuerte: true })
  }

  const conteo = textoConteoSenales(senales.conteo)

  const anulada = factura.estado === 'anulada'
  const conIva = facturaConIva(factura)
  const etiquetaAccion = conIva
    ? 'Quitar IVA'
    : `Aplicar IVA${ivaPctConfig != null && ivaPctConfig > 0 ? ` (${formatIvaPct(ivaPctConfig)})` : ''}`
  const accionIva = onCambiarIva ? (
    <Tooltip title={anulada ? 'La factura está anulada: no se puede cambiar su IVA' : ''}>
      {/* El span recibe el hover cuando el botón está deshabilitado. */}
      <span>
        <Button size="small" variant="text" onClick={onCambiarIva} disabled={anulada}>
          {etiquetaAccion}
        </Button>
      </span>
    </Tooltip>
  ) : null

  return (
    <FichaSeccion titulo="Resumen" accion={accionIva}>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          columnGap: 2,
          rowGap: 1,
          '& dd': { m: 0, textAlign: 'right', ...NUM },
        }}
      >
        {filas.map((f) => (
          <React.Fragment key={f.label}>
            <Box component="dt" sx={{ typography: 'body2', color: f.color ?? 'text.secondary' }}>
              {f.label}
              {f.nota ? (
                <Typography component="span" variant="caption" sx={{ display: 'block' }}>
                  {f.nota}
                </Typography>
              ) : null}
            </Box>
            <Box component="dd">
              <Typography
                variant="body2"
                sx={{ ...NUM, fontWeight: f.fuerte ? 600 : 400, color: f.color ?? 'text.primary' }}
              >
                {formatUsd(f.usd)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={NUM}>
                {formatBs(f.usd * tasa)}
              </Typography>
            </Box>
          </React.Fragment>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary">
        Bs a la tasa de la factura: {formatTasa(tasa)}
      </Typography>

      <Divider />

      <Box sx={{ display: 'grid', gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Margen neto (sin IVA)
          </Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              variant="h5"
              component="p"
              sx={{ ...NUM, color: margen.margen_usd < 0 ? 'error.main' : 'text.primary' }}
            >
              {formatUsd(margen.margen_usd)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={NUM}>
              {margen.margen_pct == null ? 'Sin venta' : `${formatPct(margen.margen_pct)} de ${formatUsd(margen.venta_usd)}`}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            Señales:
          </Typography>
          <NivelSenalChip nivel={senales.nivel} texto={conteo} />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Tolerancia frente al precio de referencia: {detalle.tolerancia_precio_ref_pct.toLocaleString('es-VE')} %. Las
          señales son informativas.
        </Typography>
      </Box>
    </FichaSeccion>
  )
}
