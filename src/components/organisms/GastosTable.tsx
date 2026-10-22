'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { EstadoChip, colAcciones, colFecha, colMonto } from '@/components/organisms/appDataGridColumns'
import { COLOR_ESTADO_GASTO } from '@/components/organisms/GastoDetalleDialog'
import { ETIQUETA_ESTADO_GASTO, mapaCategorias, rutaCategoria, textoTasaGasto } from '@/lib/gastos/textos'
import { formatBs, formatFecha, formatUsd } from '@/lib/format'
import type { CategoriaGasto, Gasto } from '@/types/domain'

export interface GastosTableAcciones {
  onDetalle: (g: Gasto) => void
  /** P1: solo descripción, beneficiario, referencia y notas. */
  onEditar: (g: Gasto) => void
  onAnular: (g: Gasto) => void
  /** Precarga un gasto nuevo con los datos de este (P1). */
  onRegistrarDeNuevo: (g: Gasto) => void
  /** Fase C (pendientes). */
  onConfirmar?: (g: Gasto) => void
  onDescartar?: (g: Gasto) => void
}

export interface GastosTableProps extends GastosTableAcciones {
  gastos: Gasto[]
  /** Árbol de categorías, para «Categoría › Subcategoría». */
  categorias: CategoriaGasto[]
  /** Chips de filtro (estado, categoría) a la derecha de la búsqueda. */
  filtros?: React.ReactNode
  /** Botón del estado vacío ("Registrar gasto"). */
  accionVacio?: React.ReactNode
  /** Hay filtros activos: el estado vacío lo dice. */
  filtrado?: boolean
}

function montoEnMoneda(g: Pick<Gasto, 'moneda' | 'monto'>): string {
  return g.moneda === 'bs' ? formatBs(g.monto) : formatUsd(g.monto)
}

/**
 * Listado de gastos (20-gastos), `AppDataGrid` en modo cliente: fecha,
 * categoría › subcategoría, descripción (+ beneficiario), monto en su
 * moneda, USD, tasa con su procedencia («36,50 · BCV» / «40,00 · manual») y
 * estado. `⋮`: Ver detalle, Editar (P1), Anular, Registrar de nuevo y, en
 * pendientes (Fase C), Confirmar / Descartar.
 */
export function GastosTable({
  gastos,
  categorias,
  filtros,
  accionVacio,
  filtrado = false,
  onDetalle,
  onEditar,
  onAnular,
  onRegistrarDeNuevo,
  onConfirmar,
  onDescartar,
}: GastosTableProps) {
  const mapa = React.useMemo(() => mapaCategorias(categorias), [categorias])

  const acciones = React.useCallback(
    (g: Gasto): RowAction[] => {
      const lista: RowAction[] = []
      if (g.estado === 'pendiente') {
        if (onConfirmar) lista.push({ label: 'Confirmar', onClick: () => onConfirmar(g) })
        if (onDescartar) lista.push({ label: 'Descartar', onClick: () => onDescartar(g), destructive: true })
      }
      if (g.estado === 'confirmado') {
        lista.push({ label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => onEditar(g) })
      }
      lista.push({
        label: 'Registrar de nuevo',
        icon: <ContentCopyOutlinedIcon fontSize="small" />,
        onClick: () => onRegistrarDeNuevo(g),
      })
      lista.push({ label: 'Ver detalle', icon: <InfoOutlinedIcon fontSize="small" />, onClick: () => onDetalle(g) })
      if (g.estado === 'confirmado') {
        lista.push({
          label: 'Anular',
          icon: <BlockOutlinedIcon fontSize="small" />,
          onClick: () => onAnular(g),
          destructive: true,
        })
      }
      return lista
    },
    [onAnular, onConfirmar, onDescartar, onDetalle, onEditar, onRegistrarDeNuevo]
  )

  const columns = React.useMemo<GridColDef<Gasto>[]>(
    () => [
      colFecha<Gasto>('fecha', 'Fecha', { width: 120 }),
      {
        field: 'categoria_id',
        headerName: 'Categoría',
        flex: 1,
        minWidth: 160,
        valueGetter: (_v, row) => rutaCategoria(mapa, row.categoria_id),
      },
      {
        field: 'descripcion',
        headerName: 'Descripción',
        flex: 1.6,
        minWidth: 220,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.descripcion}
            </Typography>
            {row.beneficiario ? (
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.beneficiario}
              </Typography>
            ) : null}
          </Box>
        ),
      },
      {
        field: 'monto',
        headerName: 'Monto',
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        width: 150,
        valueFormatter: (_v, row) => montoEnMoneda(row),
      },
      colMonto<Gasto>('monto_usd', 'USD', { width: 130 }),
      {
        field: 'tasa_snapshot',
        headerName: 'Tasa',
        type: 'number',
        align: 'right',
        headerAlign: 'right',
        width: 150,
        valueFormatter: (_v, row) => textoTasaGasto(row),
      },
      {
        field: 'estado',
        headerName: 'Estado',
        width: 130,
        valueFormatter: (v: Gasto['estado']) => ETIQUETA_ESTADO_GASTO[v],
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <EstadoChip label={ETIQUETA_ESTADO_GASTO[row.estado]} color={COLOR_ESTADO_GASTO[row.estado]} />
          </Box>
        ),
      },
      colAcciones<Gasto>(acciones, { rowLabel: (row) => `gasto ${row.descripcion}` }),
    ],
    [acciones, mapa]
  )

  return (
    <AppDataGrid<Gasto>
      tableId="gastos"
      label="Gastos"
      rows={gastos}
      columns={columns}
      searchPlaceholder="Buscar por descripción, beneficiario o referencia"
      getSearchValues={(g) => [g.descripcion, g.beneficiario, g.referencia, rutaCategoria(mapa, g.categoria_id)]}
      filters={filtros}
      initialSort={[{ field: 'fecha', sort: 'desc' }]}
      hideOnMobile={['tasa_snapshot', 'categoria_id']}
      emptyState={{
        icon: <ReceiptLongOutlinedIcon />,
        title: filtrado ? 'Sin gastos con estos filtros' : 'Aún no hay gastos en este período',
        description: filtrado ? 'Cambia el estado, la categoría o el rango de fechas.' : undefined,
        action: filtrado ? undefined : accionVacio,
      }}
      mobileCard={(g) => ({
        primary: g.descripcion,
        secondary: `${formatFecha(g.fecha)} · ${rutaCategoria(mapa, g.categoria_id)}`,
        status: <EstadoChip label={ETIQUETA_ESTADO_GASTO[g.estado]} color={COLOR_ESTADO_GASTO[g.estado]} />,
        amount: (
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {montoEnMoneda(g)}
            </Typography>
            {g.moneda === 'bs' && g.monto_usd !== null ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatUsd(g.monto_usd)}
              </Typography>
            ) : null}
          </Box>
        ),
        actions: <RowActionsMenu label={`gasto ${g.descripcion}`} actions={acciones(g)} size="small" />,
      })}
    />
  )
}
