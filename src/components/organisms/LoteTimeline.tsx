'use client'

import * as React from 'react'
import NextLink from 'next/link'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import { EstadoChip } from '@/components/organisms/appDataGridColumns'
import { ETIQUETA_MOTIVO } from '@/lib/loteValidation'
import { formatFecha, formatKg, formatTasa, formatUsd } from '@/lib/format'
import type { Lote, TrazabilidadLote } from '@/types/domain'

const pct = new Intl.NumberFormat('es-VE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const numeroDoc = (n: number) => String(n).padStart(4, '0')

interface Evento {
  clave: string
  fecha: string
  orden: number
  icono: React.ReactNode
  titulo: React.ReactNode
  detalle: React.ReactNode
}

function EnlaceLote({ lote, actual }: { lote: Pick<Lote, 'id' | 'codigo'>; actual: string }) {
  if (lote.id === actual) return <>{lote.codigo}</>
  return (
    <Link component={NextLink} href={`/inventario/lotes/${lote.id}`}>
      {lote.codigo}
    </Link>
  )
}

export interface LoteTimelineProps {
  traza: TrazabilidadLote
  /** Muestra costos (admin). */
  esAdmin: boolean
}

/**
 * Línea de tiempo de un lote y sus hijos (07-lotes): compra → procesamientos
 * → ventas → pérdidas → devoluciones, con enlaces al lote padre o hijo, al
 * cliente de cada factura y a las compras. Hecha con `List` (sin
 * dependencias nuevas). En un árbol, cada evento indica de qué lote es.
 */
export function LoteTimeline({ traza, esAdmin }: LoteTimelineProps) {
  const { lote, arbol } = traza
  const porId = new Map(arbol.map((l): [string, Lote] => [l.id, l]))
  const varios = arbol.length > 1
  const deLote = (id: string) => {
    const l = porId.get(id)
    return varios && l ? (
      <>
        {' · '}
        <EnlaceLote lote={l} actual={lote.id} />
      </>
    ) : null
  }

  const eventos: Evento[] = []

  for (const l of arbol) {
    if (l.origen === 'compra') {
      eventos.push({
        clave: `in-${l.id}`,
        fecha: l.fecha_ingreso,
        orden: 0,
        icono: <LocalShippingOutlinedIcon />,
        titulo: (
          <>
            Compra de {formatKg(l.peso_inicial_kg)}
            {l.proveedor_nombre ? ` a ${l.proveedor_nombre}` : ''}
            {deLote(l.id)}
          </>
        ),
        detalle: (
          <>
            {esAdmin && l.costo_usd_kg != null ? `${formatUsd(l.costo_usd_kg)}/kg · ` : ''}
            Moneda {l.moneda.toUpperCase()} · tasa {formatTasa(l.tasa_snapshot)} ·{' '}
            <Link component={NextLink} href="/compras">
              Ver compras
            </Link>
          </>
        ),
      })
    } else if (l.origen === 'proceso' && l.id === lote.id && l.lote_padre_id) {
      eventos.push({
        clave: `in-${l.id}`,
        fecha: l.fecha_ingreso,
        orden: 0,
        icono: <ContentCutOutlinedIcon />,
        titulo: (
          <>
            Nace de procesar el lote{' '}
            <EnlaceLote lote={{ id: l.lote_padre_id, codigo: l.lote_padre_codigo ?? 'padre' }} actual={lote.id} />
          </>
        ),
        detalle: (
          <>
            {formatKg(l.peso_inicial_kg)} obtenidos
            {esAdmin && l.costo_usd_kg != null ? ` · ${formatUsd(l.costo_usd_kg)}/kg (incluye la merma)` : ''}
          </>
        ),
      })
    }
  }

  for (const p of traza.procesos) {
    const merma = p.peso_entrada_kg - p.peso_salida_kg
    eventos.push({
      clave: `pr-${p.proceso_item_id}`,
      fecha: p.fecha,
      orden: 1,
      icono: <ContentCutOutlinedIcon />,
      titulo: (
        <>
          Procesamiento: {formatKg(p.peso_entrada_kg)} → {formatKg(p.peso_salida_kg)}
          {deLote(p.lote_origen_id)}
        </>
      ),
      detalle: (
        <>
          Merma {formatKg(merma)} ({pct.format(p.peso_entrada_kg > 0 ? merma / p.peso_entrada_kg : 0)}) ·
          rendimiento {pct.format(p.peso_entrada_kg > 0 ? p.peso_salida_kg / p.peso_entrada_kg : 0)}
          {p.lote_destino_id ? (
            <>
              {' · lote '}
              <EnlaceLote
                lote={{ id: p.lote_destino_id, codigo: p.lote_destino_codigo ?? 'generado' }}
                actual={lote.id}
              />
            </>
          ) : null}
        </>
      ),
    })
  }

  for (const v of traza.ventas) {
    eventos.push({
      clave: `v-${v.id}`,
      fecha: v.fecha,
      orden: 2,
      icono: <ReceiptLongOutlinedIcon />,
      titulo: (
        <>
          Venta de {formatKg(v.peso_kg)} · factura {numeroDoc(v.factura_numero)}
          {deLote(v.lote_id)}
          {v.factura_estado === 'anulada' ? (
            <Box component="span" sx={{ ml: 1 }}>
              <EstadoChip label="Anulada" color="default" />
            </Box>
          ) : null}
        </>
      ),
      detalle: (
        <>
          <Link component={NextLink} href={`/clientes/${v.cliente_id}`}>
            {v.cliente_nombre}
          </Link>
          {` · ${formatUsd(v.precio_usd_kg)}/kg · tasa ${formatTasa(v.tasa_factura)}`}
          {esAdmin && v.costo_usd_kg != null ? ` · costo ${formatUsd(v.costo_usd_kg)}/kg` : ''}
        </>
      ),
    })
  }

  for (const p of traza.perdidas) {
    eventos.push({
      clave: `p-${p.id}`,
      fecha: p.fecha,
      orden: 3,
      icono: <RemoveCircleOutlineOutlinedIcon color="error" />,
      titulo: (
        <>
          {p.motivo === 'cierre' ? 'Cierre del lote' : 'Pérdida'}: {formatKg(p.peso_kg)} ·{' '}
          {ETIQUETA_MOTIVO[p.motivo]}
          {deLote(p.lote_id)}
        </>
      ),
      detalle: (
        <>
          {p.usuario_nombre ?? 'Usuario'}
          {p.detalle ? ` · ${p.detalle}` : ''}
        </>
      ),
    })
  }

  for (const d of traza.devoluciones) {
    eventos.push({
      clave: `d-${d.id}`,
      fecha: d.fecha,
      orden: 4,
      icono: <UndoOutlinedIcon />,
      titulo: (
        <>
          Devolución de {formatKg(d.peso_kg)} · nota de crédito {numeroDoc(d.nota_numero)}
          {deLote(d.lote_id)}
          {d.nota_estado === 'anulada' ? (
            <Box component="span" sx={{ ml: 1 }}>
              <EstadoChip label="Anulada (revertida)" color="default" />
            </Box>
          ) : null}
        </>
      ),
      detalle: (
        <>
          Sobre la factura {numeroDoc(d.factura_numero)} ·{' '}
          <Link component={NextLink} href="/notas-credito">
            Ver notas de crédito
          </Link>
        </>
      ),
    })
  }

  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden)

  if (eventos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin movimientos todavía.
      </Typography>
    )
  }

  return (
    <List disablePadding aria-label={`Historia del lote ${lote.codigo}`}>
      {eventos.map((e, i) => (
        <ListItem
          key={e.clave}
          alignItems="flex-start"
          disableGutters
          sx={{
            position: 'relative',
            pb: i === eventos.length - 1 ? 0 : 2,
            // Línea vertical que une los eventos.
            '&::before':
              i === eventos.length - 1
                ? undefined
                : {
                    content: '""',
                    position: 'absolute',
                    left: 19,
                    top: 40,
                    bottom: 0,
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                  },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, mt: 0.5, color: 'text.secondary' }}>{e.icono}</ListItemIcon>
          <ListItemText
            primary={e.titulo}
            secondary={
              <>
                {formatFecha(e.fecha)} · {e.detalle}
              </>
            }
            slotProps={{
              primary: { variant: 'body2', sx: { fontWeight: 500 } },
              secondary: { variant: 'caption', component: 'div' },
            }}
          />
        </ListItem>
      ))}
    </List>
  )
}
