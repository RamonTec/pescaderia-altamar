'use client'

import * as React from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import { EstadoChip } from '@/components/atoms/EstadoChip'
import Fade from '@mui/material/Fade'
import Link from '@mui/material/Link'
import { useTheme } from '@mui/material/styles'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import { EstadoCarteraChip } from '@/components/atoms/EstadoCarteraChip'
import { EmptyState } from '@/components/molecules/EmptyState'
import { FichaHeader } from '@/components/molecules/FichaHeader'
import { FichaSeccion } from '@/components/molecules/FichaSeccion'
import { ListaResumen, type FilaResumen } from '@/components/molecules/ListaResumen'
import { CambiarIvaFacturaDialog } from '@/components/organisms/CambiarIvaFacturaDialog'
import { CorregirLineaFacturaDialog } from '@/components/organisms/CorregirLineaFacturaDialog'
import { FacturaTotalesCard } from '@/components/organisms/FacturaTotalesCard'
import { FacturaTrazabilidadLineas } from '@/components/organisms/FacturaTrazabilidadLineas'
import { HistorialCorreccionesFactura } from '@/components/organisms/HistorialCorreccionesFactura'
import { estadoDe } from '@/lib/cartera/estado'
import { numeroFactura } from '@/lib/repositories/carteraRepository'
import { numeroContrato } from '@/lib/contratos/textos'
import { ETIQUETA_METODO } from '@/lib/dashboard/etiquetas'
import { formatBs, formatFecha, formatKg, formatTasa, formatUsd } from '@/lib/format'
import type { CambiarIvaValues, CorregirLineaValues } from '@/lib/correccionFacturaValidation'
import type { DetalleFactura, LineaDetalle } from '@/types/domain'
import { cambiarIvaFacturaAction, corregirLineaFacturaAction, disponibleProductoAction } from './actions'

export interface FacturaFichaProps {
  detalle: DetalleFactura
  /** Hoy en Venezuela y días de aviso (estado de cobro igual que la cartera). */
  hoy: string
  diasAviso: number
  /** `config_negocio.iva_pct` vigente (18): el que aplica «Aplicar IVA». */
  ivaPctConfig: number
}

/**
 * Ficha de una factura (17, solo admin): resumen con saldo o saldo a favor y
 * margen, líneas con su trazabilidad y señales, notas de crédito, pagos e
 * historial de correcciones. "Corregir" abre `CorregirLineaFacturaDialog`;
 * «Quitar IVA» / «Aplicar IVA» (18) abre `CambiarIvaFacturaDialog`.
 */
export function FacturaFicha({ detalle, hoy, diasAviso, ivaPctConfig }: FacturaFichaProps) {
  const router = useRouter()
  const theme = useTheme()
  const [corrigiendo, setCorrigiendo] = React.useState<LineaDetalle | null>(null)
  const [cambiandoIva, setCambiandoIva] = React.useState(false)
  // Cada apertura monta el diálogo de cero (motivo vacío).
  const [aperturaIva, setAperturaIva] = React.useState(0)
  const { factura, contrato, correcciones } = detalle
  const numero = numeroFactura(factura.numero)
  const anulada = factura.estado === 'anulada'
  const nombreProducto = new Map(detalle.lineas.map((l) => [l.id, l.producto.nombre]))

  const estado = estadoDe(
    {
      id: factura.id,
      numero,
      fecha: factura.fecha.slice(0, 10),
      fecha_vencimiento: factura.fecha_vencimiento.slice(0, 10),
      total_usd: factura.total_usd,
      pagado_usd: factura.pagado_usd,
      creditos_usd: detalle.saldo.creditos_usd,
      anulado: anulada,
    },
    hoy,
    diasAviso
  )

  const notas: FilaResumen[] = detalle.notas_credito.map((n) => ({
    id: n.id,
    primary: `Nota ${String(n.numero).padStart(4, '0')} · ${n.motivo}`,
    secondary: [
      formatFecha(n.fecha),
      ...n.items.map(
        (i) =>
          `${nombreProducto.get(i.factura_item_id) ?? 'Línea'} ${formatKg(i.peso_kg)} × ${formatUsd(i.precio_usd_kg)}${i.afecta_inventario ? ' (vuelve a inventario)' : ''}`
      ),
    ].join(' · '),
    amount: formatUsd(n.total_usd),
    status: n.estado === 'anulada' ? <EstadoChip tono="neutral" label="Anulada" /> : undefined,
  }))

  const pagos: FilaResumen[] = detalle.pagos.map((p) => ({
    id: p.id,
    primary: `${formatUsd(p.monto_usd)} · ${ETIQUETA_METODO[p.metodo]}`,
    secondary: `${formatFecha(p.fecha)} · ${p.moneda_pago === 'bs' ? `en Bs a ${formatTasa(p.tasa_pago)}` : 'en USD'}`,
    amount: p.moneda_pago === 'bs' ? formatBs(p.monto_usd * p.tasa_pago) : undefined,
    amountDetail:
      p.moneda_pago === 'bs' && p.ganancia_cambiaria_bs !== 0
        ? `${p.ganancia_cambiaria_bs >= 0 ? 'Ganancia' : 'Pérdida'} cambiaria ${formatBs(Math.abs(p.ganancia_cambiaria_bs))}`
        : undefined,
  }))

  const onCorregir = React.useCallback(
    (values: CorregirLineaValues) => corregirLineaFacturaAction(values, factura.numero),
    [factura.numero]
  )
  const onCambiarIva = React.useCallback(
    (values: CambiarIvaValues) => cambiarIvaFacturaAction(values, factura.numero),
    [factura.numero]
  )

  return (
    <Fade in timeout={theme.transitions.duration.short}>
      <Box sx={{ display: 'grid', gap: 3 }}>
        <FichaHeader
          backHref="/cobros"
          backLabel="Cobros"
          title={`Factura ${numero}`}
          meta={
            <>
              <Link component={NextLink} href={`/clientes/${factura.cliente.id}`} underline="hover">
                {factura.cliente.nombre}
              </Link>
              <span>{formatFecha(factura.fecha)}</span>
              <span>
                {factura.condicion === 'credito'
                  ? `Crédito ${factura.dias_credito} ${factura.dias_credito === 1 ? 'día' : 'días'}`
                  : 'Contado'}
              </span>
              <span>Vence {formatFecha(factura.fecha_vencimiento)}</span>
              <EstadoCarteraChip estado={estado} />
              {correcciones.length > 0 ? (
                <EstadoChip tono="neutral" label={`Corregida · ${correcciones.length}`} />
              ) : null}
              {contrato?.desactualizado ? (
                <EstadoChip
                  tono="warning"
                  label="Contrato desactualizado"
                  tooltip={`El contrato ${numeroContrato(contrato.numero)} es anterior a una corrección: anúlalo y genera otro desde Cobros o Contratos`}
                />
              ) : null}
            </>
          }
        />

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <FacturaTrazabilidadLineas
              lineas={detalle.lineas}
              toleranciaPct={detalle.tolerancia_precio_ref_pct}
              anulada={anulada}
              onCorregir={setCorrigiendo}
            />

            <FichaSeccion titulo="Historial de correcciones">
              <HistorialCorreccionesFactura correcciones={correcciones} />
            </FichaSeccion>
          </Box>

          <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <FacturaTotalesCard
              detalle={detalle}
              ivaPctConfig={ivaPctConfig}
              onCambiarIva={() => {
                setAperturaIva((n) => n + 1)
                setCambiandoIva(true)
              }}
            />

            <FichaSeccion titulo="Notas de crédito">
              {notas.length > 0 ? (
                <ListaResumen filas={notas} ariaLabel="Notas de crédito de la factura" />
              ) : (
                <EmptyState compact icon={<UndoOutlinedIcon fontSize="large" />} title="Sin notas de crédito" />
              )}
            </FichaSeccion>

            <FichaSeccion titulo="Pagos">
              {pagos.length > 0 ? (
                <ListaResumen filas={pagos} ariaLabel="Pagos de la factura" />
              ) : (
                <EmptyState compact icon={<PaymentsOutlinedIcon fontSize="large" />} title="Sin abonos" />
              )}
            </FichaSeccion>
          </Box>
        </Box>

        <CorregirLineaFacturaDialog
          key={corrigiendo?.id ?? 'cerrado'}
          detalle={detalle}
          linea={corrigiendo}
          onClose={() => setCorrigiendo(null)}
          onCorregir={onCorregir}
          onCorregida={() => router.refresh()}
          cargarDisponible={disponibleProductoAction}
        />

        <CambiarIvaFacturaDialog
          key={`iva-${aperturaIva}`}
          detalle={detalle}
          open={cambiandoIva}
          ivaPctConfig={ivaPctConfig}
          onClose={() => setCambiandoIva(false)}
          onCambiar={onCambiarIva}
          onCambiado={() => router.refresh()}
        />
      </Box>
    </Fade>
  )
}
