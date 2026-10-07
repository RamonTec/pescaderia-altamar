'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import FilterListOffOutlinedIcon from '@mui/icons-material/FilterListOffOutlined'
import { EstadoCarteraChip } from '@/components/atoms/EstadoCarteraChip'
import type { EmptyStateProps } from '@/components/molecules/EmptyState'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { colAcciones, colFecha, colMonto } from '@/components/organisms/appDataGridColumns'
import { formatFecha, formatUsd } from '@/lib/format'
import {
  ETIQUETA_ESTADO,
  PESO_ESTADO,
  estadoDe,
  ordenarPorGravedad,
  saldoDocumento,
  textoVencimiento,
} from '@/lib/cartera/estado'
import type { DocumentoCartera, EstadoCartera } from '@/lib/cartera/types'

/** Filtro de la tabla: un estado o todos (las anuladas, aparte, con "Ver anuladas"). */
export type FiltroCartera = Exclude<EstadoCartera, 'anulada'> | 'todas'

const CHIPS: { value: FiltroCartera; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'pagada', label: 'Pagadas' },
]

/** Fila con estado y saldo resueltos una vez (no en cada celda). */
interface Fila extends DocumentoCartera {
  _estado: EstadoCartera
  _saldo: number
  _abonado: number
  _vence: string | null
}

export interface DocumentosCarteraTableProps {
  /** Identificador de la tabla (tamaño de página recordado). */
  tableId: string
  label: string
  documentos: readonly DocumentoCartera[]
  /** Hoy en Venezuela (`YYYY-MM-DD`), del servidor: el estado se calcula igual en ambos lados. */
  hoy: string
  diasAviso: number
  /** Columna de contraparte (cliente/proveedor) para listados globales (`/cobros`). */
  mostrarCliente?: boolean
  /** Encabezado de la columna de contraparte. */
  etiquetaContraparte?: string
  /** Montos (total, abonado, saldo): solo admin. */
  mostrarMontos: boolean
  /**
   * Acciones por documento (menú `⋮`). La tabla no sabe qué es un abono ni
   * un recordatorio: el dueño las provee.
   */
  renderAcciones?: (doc: DocumentoCartera) => RowAction[]
  /** Documento con una acción en curso (su `⋮` queda deshabilitado). */
  estaPendiente?: (doc: DocumentoCartera) => boolean
  filtroInicial?: FiltroCartera
  /** Filtro controlado (ej. por las tarjetas de `CarteraResumenCards`). */
  filtro?: FiltroCartera
  onFiltroChange?: (filtro: FiltroCartera) => void
  /** Sustantivo del documento ("factura"/"facturas"). */
  nombre?: { singular: string; plural: string }
  pageParam?: string
  embedded?: boolean
  getRowHref?: (doc: DocumentoCartera) => string
}

const DEFAULT_NOMBRE = { singular: 'factura', plural: 'facturas' }

/**
 * Tabla genérica de documentos de cartera (09-cuentas-por-cobrar): número,
 * contraparte opcional, fecha, vencimiento ("vence en 3 días" / "vencida
 * hace 9 días"), total, abonado y saldo (solo con montos) y estado. Orden por
 * defecto por gravedad. Chips de filtro por estado y "Ver anuladas" apagado.
 * Recibe `DocumentoCartera`, nunca `Factura`: sirve igual para cuentas por
 * pagar.
 */
export function DocumentosCarteraTable({
  tableId,
  label,
  documentos,
  hoy,
  diasAviso,
  mostrarCliente = false,
  etiquetaContraparte = 'Cliente',
  mostrarMontos,
  renderAcciones,
  estaPendiente,
  filtroInicial = 'todas',
  filtro: filtroControlado,
  onFiltroChange,
  nombre = DEFAULT_NOMBRE,
  pageParam,
  embedded = false,
  getRowHref,
}: DocumentosCarteraTableProps) {
  const [filtroLocal, setFiltroLocal] = React.useState<FiltroCartera>(filtroInicial)
  const filtro = filtroControlado ?? filtroLocal
  const [verAnuladas, setVerAnuladas] = React.useState(false)

  const cambiarFiltro = (next: FiltroCartera) => {
    setFiltroLocal(next)
    onFiltroChange?.(next)
  }

  const filasTodas = React.useMemo<Fila[]>(
    () =>
      ordenarPorGravedad(documentos, hoy, diasAviso).map((d) => ({
        ...d,
        _estado: estadoDe(d, hoy, diasAviso),
        _saldo: saldoDocumento(d),
        _abonado: Number(d.pagado_usd) + Number(d.creditos_usd),
        _vence: textoVencimiento(d, hoy, diasAviso),
      })),
    [documentos, hoy, diasAviso]
  )

  const conteo = React.useMemo(() => {
    const c: Record<FiltroCartera, number> = { todas: 0, vencida: 0, por_vencer: 0, pendiente: 0, pagada: 0 }
    let anuladas = 0
    for (const f of filasTodas) {
      if (f._estado === 'anulada') {
        anuladas++
        continue
      }
      c.todas++
      c[f._estado]++
    }
    return { ...c, anuladas }
  }, [filasTodas])

  const filas = React.useMemo(
    () =>
      filasTodas.filter((f) => {
        if (f._estado === 'anulada') return verAnuladas && filtro === 'todas'
        return filtro === 'todas' || f._estado === filtro
      }),
    [filasTodas, filtro, verAnuladas]
  )

  const columns = React.useMemo<GridColDef<Fila>[]>(() => {
    const cols: GridColDef<Fila>[] = [
      {
        field: 'numero',
        headerName: 'N.º',
        minWidth: 110,
        flex: 0.7,
      },
    ]
    if (mostrarCliente) {
      cols.push({
        field: 'contraparte',
        headerName: etiquetaContraparte,
        flex: 1.4,
        minWidth: 180,
        valueGetter: (_v, row) => row.contraparte?.nombre ?? '—',
        renderCell: ({ row }) => (
          <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {row.contraparte?.nombre ?? '—'}
            </Typography>
            {row.contraparte?.detalle ? (
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.contraparte.detalle}
              </Typography>
            ) : null}
          </Box>
        ),
      })
    }
    cols.push(
      colFecha<Fila>('fecha', 'Fecha', { flex: 0.8 }),
      {
        field: 'fecha_vencimiento',
        headerName: 'Vencimiento',
        flex: 1.1,
        minWidth: 160,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {formatFecha(row.fecha_vencimiento)}
            </Typography>
            {row._vence ? (
              <Typography
                variant="caption"
                noWrap
                color={row._estado === 'vencida' ? 'error' : 'text.secondary'}
              >
                {row._vence}
              </Typography>
            ) : null}
          </Box>
        ),
      }
    )
    if (mostrarMontos) {
      cols.push(
        colMonto<Fila>('total_usd', 'Total', { flex: 0.8 }),
        colMonto<Fila>('_abonado', 'Abonado', { flex: 0.8 }),
        colMonto<Fila>('_saldo', 'Saldo', { flex: 0.8 })
      )
    }
    cols.push({
      field: '_estado',
      headerName: 'Estado',
      minWidth: 120,
      flex: 0.8,
      sortComparator: (a: EstadoCartera, b: EstadoCartera) => PESO_ESTADO[a] - PESO_ESTADO[b],
      valueFormatter: (v: EstadoCartera) => ETIQUETA_ESTADO[v],
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <EstadoCarteraChip estado={row._estado} />
        </Box>
      ),
    })
    if (renderAcciones) {
      cols.push(
        colAcciones<Fila>((row) => renderAcciones(row), {
          rowLabel: (row) => `${nombre.singular} ${row.numero}`,
          isPending: (row) => estaPendiente?.(row) ?? false,
        })
      )
    }
    return cols
  }, [mostrarCliente, etiquetaContraparte, mostrarMontos, renderAcciones, estaPendiente, nombre.singular])

  const emptyState: EmptyStateProps =
    filtro === 'todas'
      ? {
          icon: <ReceiptLongOutlinedIcon fontSize="large" />,
          title: `Aún no hay ${nombre.plural}`,
        }
      : {
          icon: <FilterListOffOutlinedIcon fontSize="large" />,
          title: `No hay ${nombre.plural} ${ETIQUETA_ESTADO[filtro].toLowerCase()}`,
          action: (
            <Button variant="outlined" onClick={() => cambiarFiltro('todas')}>
              Ver todas
            </Button>
          ),
        }

  return (
    <AppDataGrid<Fila>
      tableId={tableId}
      label={label}
      mode="client"
      rows={filas}
      columns={columns}
      searchable={mostrarCliente}
      searchPlaceholder={`Buscar por número o ${etiquetaContraparte.toLowerCase()}`}
      getSearchValues={(row) => [row.numero, row.contraparte?.nombre, row.contraparte?.detalle]}
      hideOnMobile={['fecha', 'total_usd', '_abonado']}
      pageParam={pageParam}
      embedded={embedded}
      emptyState={emptyState}
      getRowHref={getRowHref}
      filters={
        <Box role="group" aria-label={`Filtrar ${nombre.plural}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {CHIPS.map((c) => {
            const activo = c.value === filtro
            return (
              <Chip
                key={c.value}
                label={`${c.label} (${conteo[c.value]})`}
                variant={activo ? 'soft' : 'outlined'}
                color={activo ? (c.value === 'vencida' ? 'error' : 'primary') : 'default'}
                aria-pressed={activo}
                onClick={() => cambiarFiltro(c.value)}
              />
            )
          })}
          {conteo.anuladas > 0 ? (
            <Chip
              label={`Ver anuladas (${conteo.anuladas})`}
              variant={verAnuladas ? 'soft' : 'outlined'}
              color={verAnuladas ? 'primary' : 'default'}
              aria-pressed={verAnuladas}
              onClick={() => {
                setVerAnuladas((v) => !v)
                if (filtro !== 'todas') cambiarFiltro('todas')
              }}
            />
          ) : null}
        </Box>
      }
      mobileCard={(row) => ({
        primary: mostrarCliente && row.contraparte ? `${row.numero} · ${row.contraparte.nombre}` : row.numero,
        secondary: row._vence ?? `Vence ${formatFecha(row.fecha_vencimiento)}`,
        status: <EstadoCarteraChip estado={row._estado} />,
        amount: mostrarMontos ? formatUsd(row._saldo) : undefined,
        actions: renderAcciones ? (
          <RowActionsMenu
            label={`${nombre.singular} ${row.numero}`}
            actions={renderAcciones(row)}
            pending={estaPendiente?.(row) ?? false}
            size="medium"
          />
        ) : undefined,
      })}
    />
  )
}
