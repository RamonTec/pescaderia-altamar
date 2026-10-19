'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Paper from '@mui/material/Paper'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import SetMealOutlinedIcon from '@mui/icons-material/SetMealOutlined'
import { SenalFacturaChip } from '@/components/atoms/SenalFacturaChip'
import { CadenaTrazabilidad, type EslabonCadena } from '@/components/molecules/CadenaTrazabilidad'
import { explicacionSenal } from '@/lib/facturas/senales'
import { formatBs, formatFecha, formatKg, formatPct, formatTasa, formatUsd } from '@/lib/format'
import type {
  CompraOrigenLote,
  EslabonLoteVendido,
  LineaDetalle,
  LotePadreTrazabilidad,
  Moneda,
} from '@/types/domain'

const NUM = { fontVariantNumeric: 'tabular-nums' } as const

export interface FacturaTrazabilidadLineasProps {
  lineas: readonly LineaDetalle[]
  toleranciaPct: number
  /** Factura anulada: "Corregir" deshabilitado con tooltip. */
  anulada: boolean
  onCorregir: (linea: LineaDetalle) => void
}

/** Costo/kg en USD y, si se pactó en Bs, también en Bs a la tasa de la compra. */
function costoEntrada(costoUsd: number, moneda: Moneda, tasa: number): string {
  const usd = `${formatUsd(costoUsd)}/kg`
  return moneda === 'bs'
    ? `${usd} · ${formatBs(costoUsd * tasa)}/kg (pactada en Bs, tasa ${formatTasa(tasa)})`
    : `${usd} (pactada en USD, tasa ${formatTasa(tasa)})`
}

function eslabonCompra(
  clave: string,
  compra: CompraOrigenLote | null,
  lote: { id: string; codigo: string; fecha_ingreso: string; costo: number; moneda: Moneda; tasa: number; kg?: number }
): EslabonCadena {
  return {
    clave,
    icono: <LocalShippingOutlinedIcon />,
    titulo: `Compra${compra?.proveedor_nombre ? ` · ${compra.proveedor_nombre}` : ''}`,
    lineas: [
      `${formatFecha(compra?.fecha ?? lote.fecha_ingreso)} · lote ${lote.codigo}${lote.kg != null ? ` · ${formatKg(lote.kg)}` : ''}`,
      costoEntrada(lote.costo, lote.moneda, lote.tasa),
    ],
    href: `/inventario/lotes/${lote.id}`,
    hrefLabel: 'Ver lote',
  }
}

function eslabonInicial(
  clave: string,
  lote: { id: string; codigo: string; fecha_ingreso: string; costo: number; moneda: Moneda; tasa: number }
): EslabonCadena {
  return {
    clave,
    icono: <Inventory2OutlinedIcon />,
    titulo: 'Inventario inicial',
    lineas: [`${formatFecha(lote.fecha_ingreso)} · lote ${lote.codigo} · sin proveedor`, costoEntrada(lote.costo, lote.moneda, lote.tasa)],
    href: `/inventario/lotes/${lote.id}`,
    hrefLabel: 'Ver lote',
  }
}

function eslabonPadre(padre: LotePadreTrazabilidad): EslabonCadena {
  const datos = {
    id: padre.id,
    codigo: padre.codigo,
    fecha_ingreso: padre.fecha_ingreso,
    costo: padre.costo_usd_kg,
    moneda: padre.moneda,
    tasa: padre.tasa_snapshot,
    kg: padre.peso_inicial_kg,
  }
  return padre.origen === 'compra' ? eslabonCompra('padre', padre.compra, datos) : eslabonInicial('padre', datos)
}

/** Eslabones de un lote vendido según su origen (tabla "Trazabilidad por línea" de la spec). */
function cadenaDeLote(lote: EslabonLoteVendido, precioVenta: number): EslabonCadena[] {
  const venta: EslabonCadena = {
    clave: 'venta',
    icono: <ReceiptLongOutlinedIcon />,
    titulo: `Venta · lote ${lote.codigo}`,
    lineas: [
      `${formatKg(lote.peso_kg)} × ${formatUsd(precioVenta)}/kg = ${formatUsd(lote.peso_kg * precioVenta)}`,
      `Costo ${formatUsd(lote.costo_usd_kg)}/kg · margen ${formatUsd(lote.peso_kg * (precioVenta - lote.costo_usd_kg))}`,
      `Stock actual del lote: ${formatKg(lote.stock_kg)}`,
      ...(lote.kg_devueltos > 0 ? [`${formatKg(lote.kg_devueltos)} devueltos por notas de crédito`] : []),
    ],
    href: `/inventario/lotes/${lote.lote_id}`,
    hrefLabel: 'Ver lote',
  }
  const propio = {
    id: lote.lote_id,
    codigo: lote.codigo,
    fecha_ingreso: lote.fecha_ingreso,
    costo: lote.lote_costo_usd_kg,
    moneda: lote.moneda,
    tasa: lote.tasa_snapshot,
  }

  if (lote.origen === 'compra') {
    return [
      eslabonCompra('compra', lote.compra, propio),
      { clave: 'sin-proceso', icono: <SetMealOutlinedIcon />, titulo: 'Vendido sin procesar', lineas: ['Crudo vendido tal cual entró'] },
      venta,
    ]
  }
  if (lote.origen === 'inicial') return [eslabonInicial('inicial', propio), venta]

  const p = lote.proceso
  if (!p) return [venta]
  const merma = Math.max(p.peso_entrada_kg - p.peso_salida_total_kg, 0)
  const proceso: EslabonCadena = {
    clave: 'proceso',
    icono: <ContentCutOutlinedIcon />,
    titulo: `Procesamiento · ${formatFecha(p.fecha)}`,
    lineas: [
      `Lote crudo ${p.lote_padre?.codigo ?? '—'}: entrada ${formatKg(p.peso_entrada_kg)} → ${formatKg(p.peso_salida_total_kg)} en ${p.salidas} ${p.salidas === 1 ? 'salida' : 'salidas'}`,
      `Merma ${formatKg(merma)} (${formatPct(p.peso_entrada_kg > 0 ? merma / p.peso_entrada_kg : 0)}) · rendimiento ${formatPct(p.peso_entrada_kg > 0 ? p.peso_salida_total_kg / p.peso_entrada_kg : 0)}${p.legado ? ' (registro anterior a la cabecera)' : ''}`,
      `Reparto del costo por ${p.reparto_costo === 'valor' ? 'valor de venta' : 'peso'} · esta salida ${formatKg(p.peso_salida_kg)} a ${formatUsd(lote.lote_costo_usd_kg)}/kg`,
      p.precio_referencia_usd_kg != null
        ? `Precio de referencia del reparto: ${formatUsd(p.precio_referencia_usd_kg)}/kg`
        : 'Sin precio de referencia en el reparto',
    ],
    href: '/procesamiento',
    hrefLabel: 'Ver procesamientos',
  }
  return [...(p.lote_padre ? [eslabonPadre(p.lote_padre)] : []), proceso, venta]
}

function Dato({ label, valor, color }: { label: string; valor: string; color?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ ...NUM, color: color ?? 'text.primary' }}>
        {valor}
      </Typography>
    </Box>
  )
}

function LineaCard({
  linea,
  toleranciaPct,
  anulada,
  onCorregir,
}: {
  linea: LineaDetalle
  toleranciaPct: number
  anulada: boolean
  onCorregir: (linea: LineaDetalle) => void
}) {
  const [abierta, setAbierta] = React.useState(false)
  const idCadena = React.useId()
  const { margen, senales } = linea
  const datos = {
    precio: linea.precio_usd_kg,
    costo: linea.costo_usd_kg,
    referencia: senales.precio_referencia_usd_kg,
    fuente: senales.fuente_referencia,
    toleranciaPct,
  }

  const corregir = (
    <Button
      size="small"
      variant="outlined"
      startIcon={<EditOutlinedIcon />}
      disabled={anulada}
      onClick={() => onCorregir(linea)}
    >
      Corregir
    </Button>
  )

  return (
    <Paper variant="outlined" component="article" sx={{ p: { xs: 2, sm: 2.5 }, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 500 }}>
            {linea.producto.nombre}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {senales.senales.map((s) => (
              <SenalFacturaChip key={s} tipo={s} tooltip={explicacionSenal(s, datos)} />
            ))}
            {senales.indicadores.map((s) => (
              <SenalFacturaChip key={s} tipo={s} tooltip={explicacionSenal(s, datos)} />
            ))}
          </Box>
        </Box>
        {anulada ? (
          <Tooltip title="La factura está anulada: no se puede corregir">
            <span>{corregir}</span>
          </Tooltip>
        ) : (
          corregir
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <Dato label="Peso" valor={formatKg(linea.peso_kg)} />
        <Dato label="Precio/kg" valor={formatUsd(linea.precio_usd_kg)} />
        <Dato label="Subtotal" valor={formatUsd(margen.venta_usd)} />
        <Dato label="Costo/kg" valor={linea.costo_usd_kg > 0 ? formatUsd(linea.costo_usd_kg) : 'Sin costo'} />
        <Dato
          label="Margen"
          valor={`${formatUsd(margen.margen_usd)}${margen.margen_pct != null ? ` · ${formatPct(margen.margen_pct)}` : ''}`}
          color={margen.margen_usd < 0 ? 'error.main' : undefined}
        />
        <Dato
          label="Referencia/kg"
          valor={
            senales.precio_referencia_usd_kg != null
              ? `${formatUsd(senales.precio_referencia_usd_kg)}${senales.fuente_referencia === 'catalogo' ? ' (catálogo)' : ''}`
              : '—'
          }
        />
      </Box>
      {linea.kg_devueltos > 0 ? (
        <Typography variant="caption" color="text.secondary">
          {formatKg(linea.kg_devueltos)} devueltos por notas de crédito emitidas.
        </Typography>
      ) : null}

      <Box>
        <Button
          size="small"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          aria-controls={idCadena}
          endIcon={
            <ExpandMoreOutlinedIcon
              sx={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: (t) => t.transitions.create('transform') }}
            />
          }
        >
          {abierta ? 'Ocultar trazabilidad' : `Ver trazabilidad${linea.lotes.length > 1 ? ` (${linea.lotes.length} lotes)` : ''}`}
        </Button>
        <Collapse in={abierta} unmountOnExit>
          <Box id={idCadena} sx={{ display: 'grid', gap: 2, pt: 1.5 }}>
            {linea.lotes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {linea.producto.controla_stock
                  ? 'Línea sin lotes asignados (venta anterior a los lotes): sin cadena de origen.'
                  : 'Sin control de stock: sin costo de inventario.'}
              </Typography>
            ) : (
              linea.lotes.map((l) => (
                <Box key={l.fil_id} sx={{ display: 'grid', gap: 0.75 }}>
                  {linea.lotes.length > 1 ? (
                    <Typography variant="caption" color="text.secondary" sx={NUM}>
                      Lote {l.orden} de {linea.lotes.length}: {l.codigo} · {formatKg(l.peso_kg)}
                    </Typography>
                  ) : null}
                  <CadenaTrazabilidad
                    eslabones={cadenaDeLote(l, linea.precio_usd_kg)}
                    ariaLabel={`Cadena del lote ${l.codigo}`}
                  />
                </Box>
              ))
            )}
          </Box>
        </Collapse>
      </Box>
    </Paper>
  )
}

/**
 * Líneas de una factura con su trazabilidad (17, solo admin): una tarjeta por
 * línea con kg, precio, subtotal, costo, margen, señales y kg devueltos; se
 * expande con la cadena de cada lote (compra → proceso → venta). Acción
 * "Corregir" por línea.
 */
export function FacturaTrazabilidadLineas({ lineas, toleranciaPct, anulada, onCorregir }: FacturaTrazabilidadLineasProps) {
  return (
    <Box component="section" aria-label="Líneas de la factura" sx={{ display: 'grid', gap: 1.5 }}>
      <Typography variant="h6" component="h2">
        Líneas
      </Typography>
      {lineas.map((l) => (
        <LineaCard key={l.id} linea={l} toleranciaPct={toleranciaPct} anulada={anulada} onCorregir={onCorregir} />
      ))}
    </Box>
  )
}
