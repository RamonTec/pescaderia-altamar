'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { KpiCard } from '@/components/molecules/KpiCard'
import { TasaChip } from '@/components/molecules/TasaChip'
import type {
  BloqueDashboard,
  DashboardOperativo,
  KpisDia,
  TasasDelDia,
  TasaVigente,
} from '@/types/domain'
import {
  formatBs,
  formatEntero,
  formatKg,
  formatPct,
  formatTasa,
  formatUsd,
} from '@/lib/format'

export interface KpisDiaRowProps {
  tasas: BloqueDashboard<TasasDelDia>
  operativo: BloqueDashboard<DashboardOperativo>
  /** `undefined` para el operador: no ve ventas, margen, CxC, CxP ni valor del inventario. */
  kpis?: BloqueDashboard<KpisDia>
}

const plural = (n: number, uno: string, varios: string) => `${formatEntero(n)} ${n === 1 ? uno : varios}`

function chipTasa(t: TasaVigente | null, fuente: 'bcv' | 'paralela') {
  return t ? (
    <TasaChip valor={Number(t.tasa.valor_bs)} fuente={fuente} fechaValor={t.fecha_valor} arrastrada={t.arrastrada} />
  ) : (
    <Typography variant="caption" color="text.secondary">
      {fuente === 'bcv' ? 'BCV' : 'Paralela'}: sin tasa
    </Typography>
  )
}

/**
 * Fila de KPIs del día (15, sección A): tasa del día, ventas y margen, CxC,
 * CxP, valor del inventario (solo admin), alertas de stock y pedidos
 * próximos. Grid de 1 columna en `xs`, 2 en `sm` y 4 en `md+`. Un bloque con
 * error muestra su tarjeta con el mensaje; las demás siguen.
 */
export function KpisDiaRow({ tasas, operativo, kpis }: KpisDiaRowProps) {
  const op = operativo.ok ? operativo.data : null
  const k = kpis?.ok ? kpis.data : null
  const errorKpis = kpis && !kpis.ok ? kpis.error : null

  const pedidos = op?.pedidos ?? []
  const cuenta = (g: 'atrasado' | 'hoy' | 'manana') => pedidos.filter((p) => p.grupo === g).length
  const atrasados = cuenta('atrasado')

  const sinAlertasConfig = op && op.umbral_stock_bajo_kg === null && op.dias_alerta_lote === null
  const stockBajo = op?.stock_bajo ?? []
  const antiguos = op?.lotes_antiguos ?? []

  const tarjetaAdmin = (
    title: string,
    contenido: (d: KpisDia) => Omit<React.ComponentProps<typeof KpiCard>, 'title'>
  ) =>
    kpis ? (
      <KpiCard
        title={title}
        {...(k
          ? contenido(k)
          : { value: '—', secondary: errorKpis ?? 'Sin datos', tone: 'error' as const })}
      />
    ) : null

  return (
    <Box
      component="section"
      aria-label="Indicadores del día"
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
      }}
    >
      {/* Tasa del día (todos) */}
      {tasas.ok ? (
        <KpiCard
          title="Tasa del día"
          value={tasas.data.bcv ? formatTasa(Number(tasas.data.bcv.tasa.valor_bs)) : '—'}
          secondary={`Bs por USD · BCV${tasas.data.fuente_default === 'paralela' ? ' (se convierte con la paralela)' : ''}`}
          href="/tasas"
        >
          <Box sx={{ display: 'grid', gap: 0.5, mt: 0.5 }}>
            {chipTasa(tasas.data.bcv, 'bcv')}
            {chipTasa(tasas.data.paralela, 'paralela')}
            {tasas.data.eur ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                EUR (referencia) {formatTasa(Number(tasas.data.eur.tasa.valor_bs))}
              </Typography>
            ) : null}
          </Box>
        </KpiCard>
      ) : (
        <KpiCard title="Tasa del día" value="—" secondary={tasas.error} tone="error" href="/tasas" />
      )}

      {tarjetaAdmin('Ventas del día', (d) => ({
        value: formatUsd(d.ventas_usd),
        secondary: `${formatKg(d.ventas_kg)} · ${plural(d.facturas, 'factura', 'facturas')} · sin IVA`,
      }))}

      {tarjetaAdmin('Margen del día', (d) => ({
        value: formatUsd(d.margen_usd),
        secondary:
          d.margen_pct === null ? 'Sin ventas hoy' : `${formatPct(d.margen_pct)} sobre ventas`,
        tone: d.margen_usd < 0 ? 'error' : undefined,
      }))}

      {tarjetaAdmin('Cuentas por cobrar', (d) => ({
        value: formatUsd(d.cxc_saldo_usd),
        secondary:
          d.cxc_vencido_usd > 0.005
            ? `Vencido ${formatUsd(d.cxc_vencido_usd)} · ${plural(d.cxc_clientes_vencidos, 'cliente', 'clientes')}`
            : `${plural(d.cxc_facturas, 'factura', 'facturas')} · nada vencido`,
        tone: d.cxc_vencido_usd > 0.005 ? 'error' : undefined,
        href: '/cobros',
      }))}

      {tarjetaAdmin('Cuentas por pagar', (d) => ({
        value: formatUsd(d.cxp_saldo_usd),
        secondary:
          d.cxp_vencido_usd > 0.005
            ? `Vencido ${formatUsd(d.cxp_vencido_usd)} · ${plural(d.cxp_compras, 'compra', 'compras')}`
            : `${plural(d.cxp_compras, 'compra', 'compras')} a crédito · nada vencido`,
        tone: d.cxp_vencido_usd > 0.005 ? 'error' : undefined,
        href: '/compras',
      }))}

      {tarjetaAdmin('Valor del inventario', (d) => ({
        value: formatUsd(d.inventario_usd),
        secondary:
          d.inventario_bs === null
            ? `${formatKg(d.inventario_kg)} · sin tasa para Bs`
            : `${formatBs(d.inventario_bs)} · ${formatKg(d.inventario_kg)}`,
        href: '/inventario',
      }))}

      {/* Alertas de stock (todos) */}
      {op ? (
        <KpiCard
          title="Alertas de stock"
          value={
            sinAlertasConfig
              ? '—'
              : plural(stockBajo.length + antiguos.length, 'alerta', 'alertas')
          }
          secondary={
            sinAlertasConfig
              ? 'Sin umbral ni días de alerta configurados'
              : [
                  op.umbral_stock_bajo_kg !== null
                    ? `${plural(stockBajo.length, 'producto', 'productos')} ≤ ${formatKg(op.umbral_stock_bajo_kg)}`
                    : null,
                  op.dias_alerta_lote !== null
                    ? `${plural(antiguos.length, 'lote antiguo', 'lotes antiguos')} (≥ ${op.dias_alerta_lote} días)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
          }
          tone={stockBajo.length + antiguos.length > 0 ? 'warning' : undefined}
          href="/inventario"
        >
          {stockBajo.length + antiguos.length > 0 ? (
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2, display: 'grid', gap: 0.25 }}>
              {stockBajo.slice(0, 3).map((p) => (
                <Typography key={p.producto_id} component="li" variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.producto_nombre}: {formatKg(p.stock_kg)}
                </Typography>
              ))}
              {antiguos.slice(0, 3).map((l) => (
                <Typography key={l.lote_id} component="li" variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  Lote {l.codigo} · {l.dias} días · {formatKg(l.stock_kg)}
                </Typography>
              ))}
              {stockBajo.length > 3 || antiguos.length > 3 ? (
                <Typography component="li" variant="caption" color="text.secondary">
                  y más en Inventario
                </Typography>
              ) : null}
            </Box>
          ) : null}
        </KpiCard>
      ) : (
        <KpiCard
          title="Alertas de stock"
          value="—"
          secondary={operativo.ok ? '' : operativo.error}
          tone="error"
        />
      )}

      {/* Pedidos próximos (todos) */}
      {op ? (
        <KpiCard
          title="Pedidos por entregar"
          value={plural(cuenta('hoy') + cuenta('manana'), 'pedido', 'pedidos')}
          secondary={`Hoy ${cuenta('hoy')} · Mañana ${cuenta('manana')}${atrasados ? ` · ${atrasados} atrasados` : ''}`}
          tone={atrasados > 0 ? 'error' : undefined}
          href="/pedidos"
        />
      ) : (
        <KpiCard title="Pedidos por entregar" value="—" secondary={operativo.ok ? '' : operativo.error} tone="error" />
      )}
    </Box>
  )
}

/** Skeleton de la fila de KPIs (`loading.tsx` y `Suspense`). */
export function KpisDiaRowSkeleton({ tarjetas = 8 }: { tarjetas?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
      }}
    >
      {Array.from({ length: tarjetas }, (_, i) => (
        <KpiCard key={i} title="Cargando…" loading />
      ))}
    </Box>
  )
}
