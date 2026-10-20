'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { FichaSeccion } from '@/components/molecules/FichaSeccion'
import { textoProcedenciaTasa } from '@/lib/compras/textos'
import { formatBs, formatTasa, formatUsd } from '@/lib/format'
import type { DetalleCompra } from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

interface Fila {
  label: string
  usd: number
  fuerte?: boolean
  color?: string
  nota?: string
}

/**
 * Resumen de una compra (19, solo admin): total, pagos registrados, lo
 * pagado al registrar (contado) y saldo, o **saldo a favor del negocio** (en
 * verde) cuando lo pagado supera el total. En USD y en Bs a la tasa de la
 * compra, con la procedencia de la tasa.
 */
export function CompraResumenCard({ detalle }: { detalle: DetalleCompra }) {
  const { compra, pagos_registrados_usd: pagos } = detalle
  const tasa = compra.tasa_snapshot
  const implicito = Math.max(Math.round((compra.pagado_usd - pagos) * 1e6) / 1e6, 0)
  const saldo = Math.round((compra.subtotal_usd - compra.pagado_usd) * 1e6) / 1e6

  const filas: Fila[] = [{ label: 'Total', usd: compra.subtotal_usd, fuerte: true }]
  if (pagos > 0 || compra.condicion === 'credito') filas.push({ label: 'Pagos registrados', usd: pagos })
  if (implicito > 0) filas.push({ label: 'Pagado al registrar', usd: implicito, nota: 'compra de contado' })
  if (saldo < 0) {
    filas.push({ label: 'Saldo a favor', usd: -saldo, fuerte: true, color: 'success.main', nota: 'a favor del negocio' })
  } else {
    filas.push({ label: 'Saldo', usd: saldo, fuerte: true })
  }

  return (
    <FichaSeccion titulo="Resumen">
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
              <Typography variant="body2" sx={{ ...NUM, fontWeight: f.fuerte ? 600 : 400, color: f.color ?? 'text.primary' }}>
                {formatUsd(f.usd)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={NUM}>
                {formatBs(f.usd * tasa)}
              </Typography>
            </Box>
          </React.Fragment>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={NUM}>
        Bs a la tasa de la compra: {formatTasa(tasa)} · {textoProcedenciaTasa(compra)}
      </Typography>
    </FichaSeccion>
  )
}
