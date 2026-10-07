'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import {
  AppDataGrid,
  type AppDataGridQuery,
} from '@/components/organisms/AppDataGrid'
import {
  colAcciones,
  colEstado,
  colFecha,
  EstadoChip,
  type EstadoDef,
} from '@/components/organisms/appDataGridColumns'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { diasEnCava, esAntiguo, porcentajeRestante } from '@/lib/lotes'
import { formatKg } from '@/lib/format'
import type { EstadoLote, Lote, Producto, Proveedor } from '@/types/domain'
import type { PaginaLotes } from '@/lib/repositories/interfaces'

export const ESTADOS_LOTE: Record<EstadoLote, EstadoDef> = {
  abierto: { label: 'Abierto', color: 'success' },
  agotado: { label: 'Agotado', color: 'default' },
  cerrado: { label: 'Cerrado', color: 'default' },
}

export interface FiltrosLotesTabla {
  estado: EstadoLote | null
  productoId: string | null
  proveedorId: string | null
}

export interface LotesTableProps {
  /** Primera página resuelta en el servidor (filtro inicial: abiertos). */
  inicial: PaginaLotes
  productos: Producto[]
  proveedores: Proveedor[]
  diasAlertaLote: number | null
  /** Trae una página (Server Action `listarLotesAction`). */
  cargar: (
    filtros: FiltrosLotesTabla & { codigo: string; page: number; pageSize: number }
  ) => Promise<{ data: PaginaLotes | null; error: string | null }>
  acciones: (lote: Lote) => RowAction[]
  estaPendiente: (id: string) => boolean
  /** Recibe la función que vuelve a pedir la página actual (tras una acción). */
  registrarRecarga?: (recargar: () => void) => void
  /** Se llama al cambiar un filtro (para volver a la página 1 en la URL). */
  onFiltrosChange?: () => void
}

const FILTROS_ESTADO: { valor: EstadoLote | null; label: string }[] = [
  { valor: 'abierto', label: 'Abiertos' },
  { valor: 'agotado', label: 'Agotados' },
  { valor: 'cerrado', label: 'Cerrados' },
  { valor: null, label: 'Todos' },
]

function Restante({ lote }: { lote: Lote }) {
  const pct = porcentajeRestante(lote)
  return (
    <Box sx={{ width: '100%', display: 'grid', gap: 0.5 }}>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {formatKg(lote.stock_kg)}
        <Typography component="span" variant="caption" color="text.secondary">
          {' '}
          de {formatKg(lote.peso_inicial_kg)}
        </Typography>
      </Typography>
      <LinearProgress
        variant="determinate"
        value={pct}
        aria-label={`Queda ${Math.round(pct)} %`}
        color={pct <= 15 ? 'warning' : 'primary'}
        sx={{ height: 4, borderRadius: 2 }}
      />
    </Box>
  )
}

/**
 * Pestaña Lotes de `/inventario` (07-lotes): `AppDataGrid` con paginación
 * en servidor; búsqueda por código (lo primero en `xs`, se usa frente a la
 * cava), filtros por estado, producto y proveedor, % restante y chip
 * "antiguo". Toda la fila abre la trazabilidad; el `⋮` registra pérdidas o
 * cierra el lote.
 */
export function LotesTable({
  inicial,
  productos,
  proveedores,
  diasAlertaLote,
  cargar,
  acciones,
  estaPendiente,
  registrarRecarga,
  onFiltrosChange,
}: LotesTableProps) {
  const [pagina, setPagina] = React.useState<PaginaLotes>(inicial)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filtros, setFiltros] = React.useState<FiltrosLotesTabla>({
    estado: 'abierto',
    productoId: null,
    proveedorId: null,
  })
  const consultaRef = React.useRef<AppDataGridQuery>({ page: 0, pageSize: 25, sort: [], search: '' })
  const filtrosRef = React.useRef(filtros)
  const pedidoRef = React.useRef(0)
  const config = { dias_alerta_lote: diasAlertaLote }

  const pedir = React.useCallback(
    async (q: AppDataGridQuery, f: FiltrosLotesTabla) => {
      const id = ++pedidoRef.current
      consultaRef.current = q
      setLoading(true)
      setError(null)
      try {
        const r = await cargar({ ...f, codigo: q.search, page: q.page, pageSize: q.pageSize })
        if (id !== pedidoRef.current) return
        if (r.error || !r.data) setError(r.error ?? 'No se pudieron cargar los lotes.')
        else setPagina(r.data)
      } catch {
        if (id === pedidoRef.current) setError('No se pudieron cargar los lotes. Revisa tu conexión.')
      } finally {
        if (id === pedidoRef.current) setLoading(false)
      }
    },
    [cargar]
  )

  React.useEffect(() => {
    registrarRecarga?.(() => void pedir(consultaRef.current, filtrosRef.current))
  }, [registrarRecarga, pedir])

  const cambiarFiltros = (cambio: Partial<FiltrosLotesTabla>) => {
    const siguiente = { ...filtrosRef.current, ...cambio }
    filtrosRef.current = siguiente
    setFiltros(siguiente)
    onFiltrosChange?.()
    void pedir({ ...consultaRef.current, page: 0 }, siguiente)
  }

  const columns = React.useMemo<GridColDef<Lote>[]>(() => {
    const alerta = { dias_alerta_lote: diasAlertaLote }
    return [
      {
        field: 'codigo',
        headerName: 'Código',
        minWidth: 160,
        flex: 1,
        sortable: false,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.codigo}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'producto_nombre',
        headerName: 'Producto',
        minWidth: 160,
        flex: 1.2,
        sortable: false,
      },
      {
        field: 'proveedor_nombre',
        headerName: 'Proveedor',
        minWidth: 150,
        flex: 1,
        sortable: false,
        valueFormatter: (v: string | null) => v ?? '—',
      },
      colFecha<Lote>('fecha_ingreso', 'Ingreso', { sortable: false }),
      {
        field: 'dias',
        headerName: 'Días',
        minWidth: 110,
        sortable: false,
        valueGetter: (_v, row) => diasEnCava(row),
        renderCell: ({ row, value }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </Typography>
            {esAntiguo(row, alerta) ? <EstadoChip label="Antiguo" color="warning" /> : null}
          </Box>
        ),
      },
      {
        field: 'stock_kg',
        headerName: 'Restante',
        minWidth: 190,
        flex: 1,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            <Restante lote={row} />
          </Box>
        ),
      },
      colEstado<Lote>('estado', 'Estado', ESTADOS_LOTE, { sortable: false }),
      colAcciones<Lote>(acciones, {
        rowLabel: (row) => `lote ${row.codigo}`,
        isPending: (row) => estaPendiente(row.id),
      }),
    ]
  }, [acciones, estaPendiente, diasAlertaLote])

  const filtrosUi = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      {FILTROS_ESTADO.map((f) => (
        <Chip
          key={f.label}
          label={f.label}
          size="small"
          color={filtros.estado === f.valor ? 'primary' : 'default'}
          variant={filtros.estado === f.valor ? 'filled' : 'outlined'}
          onClick={() => cambiarFiltros({ estado: f.valor })}
        />
      ))}
      <TextField
        select
        size="small"
        label="Producto"
        value={filtros.productoId ?? ''}
        onChange={(e) => cambiarFiltros({ productoId: e.target.value || null })}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">Todos</MenuItem>
        {productos.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.nombre}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Proveedor"
        value={filtros.proveedorId ?? ''}
        onChange={(e) => cambiarFiltros({ proveedorId: e.target.value || null })}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">Todos</MenuItem>
        {proveedores.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.nombre}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )

  return (
    <AppDataGrid<Lote>
      tableId="inventario-lotes"
      label="Lotes"
      rows={pagina.rows}
      columns={columns}
      mode="server"
      rowCount={pagina.total}
      onQueryChange={(q) => void pedir(q, filtrosRef.current)}
      loading={loading}
      error={error}
      onRetry={() => void pedir(consultaRef.current, filtrosRef.current)}
      searchPlaceholder="Buscar por código de lote"
      filters={filtrosUi}
      getRowHref={(row) => `/inventario/lotes/${row.id}`}
      hideOnMobile={['proveedor_nombre', 'fecha_ingreso', 'producto_nombre']}
      mobileCard={(row) => {
        const dias = diasEnCava(row)
        return {
          primary: row.codigo,
          secondary: `${row.producto_nombre} · ${dias} ${dias === 1 ? 'día' : 'días'}${
            row.proveedor_nombre ? ` · ${row.proveedor_nombre}` : ''
          }`,
          status: (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {esAntiguo(row, config) ? <EstadoChip label="Antiguo" color="warning" /> : null}
              <EstadoChip label={ESTADOS_LOTE[row.estado].label} color={ESTADOS_LOTE[row.estado].color} />
            </Box>
          ),
          amount: formatKg(row.stock_kg),
          actions: (
            <RowActionsMenu
              label={`lote ${row.codigo}`}
              actions={acciones(row)}
              pending={estaPendiente(row.id)}
              size="small"
            />
          ),
        }
      }}
      emptyState={{
        icon: <Inventory2OutlinedIcon fontSize="large" />,
        title: filtros.estado === 'abierto' ? 'No hay lotes abiertos' : 'No hay lotes',
        description: 'Cada línea de compra y de procesamiento crea un lote.',
      }}
    />
  )
}
