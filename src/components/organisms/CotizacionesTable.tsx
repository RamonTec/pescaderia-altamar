'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { RangoFechasSelector } from '@/components/molecules/RangoFechasSelector'
import { CotizacionEstadoChip } from '@/components/molecules/CotizacionEstadoChip'
import { AppDataGrid, type AppDataGridQuery } from '@/components/organisms/AppDataGrid'
import { colAcciones, colFecha, colMonto } from '@/components/organisms/appDataGridColumns'
import { accionesPermitidas, diasParaVencer, type AccionCotizacion } from '@/lib/cotizaciones/estado'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import { inicioMes } from '@/lib/dashboard/rangos'
import { formatFecha, formatUsd } from '@/lib/format'
import type { FiltrosCotizacionesUrl } from '@/lib/cotizacionValidation'
import type { CotizacionListado } from '@/types/domain'

const FILTROS_ESTADO: { value: FiltrosCotizacionesUrl['estado']; label: string }[] = [
  { value: 'abiertas', label: 'Abiertas' },
  { value: 'todas', label: 'Todas' },
  { value: 'borrador', label: 'Borradores' },
  { value: 'enviada', label: 'Enviadas' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'aceptada', label: 'Aceptadas' },
  { value: 'rechazada', label: 'Rechazadas' },
  { value: 'anulada', label: 'Anuladas' },
]

const BUSQUEDA_DEBOUNCE_MS = 300

/** Orden y textos del `⋮` (spec: Compartir, Descargar PDF, Editar, Duplicar, Anular). */
const ACCIONES_MENU: { accion: AccionCotizacion; label: string; destructive?: boolean }[] = [
  { accion: 'compartir', label: 'Compartir' },
  { accion: 'descargar_pdf', label: 'Descargar PDF' },
  { accion: 'editar', label: 'Editar' },
  { accion: 'renovar', label: 'Renovar' },
  { accion: 'duplicar', label: 'Duplicar' },
  { accion: 'anular', label: 'Anular', destructive: true },
]

export type ManejadoresAccionCotizacion = Partial<Record<AccionCotizacion, (row: CotizacionListado) => void>>

export interface CotizacionesTableProps {
  cotizaciones: CotizacionListado[]
  total: number
  filtros: FiltrosCotizacionesUrl
  /** Hoy en Venezuela (del servidor), para «Vence» y el rango. */
  hoy: string
  /** Acciones disponibles en el `⋮`; solo aparecen las que `accionesPermitidas` deja. */
  acciones: ManejadoresAccionCotizacion
  onNueva: () => void
  /** Fila con una acción en curso. */
  pendienteId?: string | null
}

function ClienteCelda({ row }: { row: CotizacionListado }) {
  return (
    <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
      <Typography variant="body2" noWrap>
        {row.cliente}
      </Typography>
      {row.telefono ? (
        <Typography variant="caption" color="text.secondary">
          {row.telefono}
        </Typography>
      ) : null}
    </Box>
  )
}

function VenceTexto({ row, hoy }: { row: CotizacionListado; hoy: string }) {
  const abierta = row.estado_efectivo === 'borrador' || row.estado_efectivo === 'enviada'
  const pronto = abierta && diasParaVencer(row.fecha_vencimiento, hoy) <= 2
  return (
    <Typography variant="body2" component="span" color={pronto ? 'warning.main' : undefined}>
      {formatFecha(row.fecha_vencimiento)}
    </Typography>
  )
}

/**
 * Listado de cotizaciones (21-cotizaciones): `AppDataGrid` en modo servidor
 * sobre `cotizaciones_listado_view`, con chips `?estado=` (por defecto
 * «Abiertas»), búsqueda `?q=` (número `cot123`, nombre o teléfono), rango
 * `?desde`/`?hasta` opcional y página en la URL. La fila abre la ficha.
 */
export function CotizacionesTable({
  cotizaciones,
  total,
  filtros,
  hoy,
  acciones,
  onNueva,
  pendienteId = null,
}: CotizacionesTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [cargando, startTransition] = React.useTransition()
  const [busqueda, setBusqueda] = React.useState(filtros.q ?? '')
  const debounceRef = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(debounceRef.current), [])

  const navegar = React.useCallback(
    (cambios: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search)
      for (const [k, v] of Object.entries(cambios)) {
        if (v === null || v === '') params.delete(k)
        else params.set(k, v)
      }
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname]
  )

  const onQueryChange = React.useCallback(
    (q: AppDataGridQuery) => {
      navegar({
        pagina: q.page > 0 ? String(q.page + 1) : null,
        limite: q.pageSize !== 25 ? String(q.pageSize) : null,
      })
    },
    [navegar]
  )

  const onBuscar = (valor: string) => {
    setBusqueda(valor)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(
      () => navegar({ q: valor.trim() || null, pagina: null }),
      BUSQUEDA_DEBOUNCE_MS
    )
  }

  const accionesDe = React.useCallback(
    (row: CotizacionListado): RowAction[] => {
      const permitidas = accionesPermitidas(row.estado_efectivo)
      return ACCIONES_MENU.flatMap((a) => {
        const fn = acciones[a.accion]
        if (!fn || !permitidas.has(a.accion)) return []
        return [{ label: a.label, destructive: a.destructive, onClick: () => fn(row) }]
      })
    },
    [acciones]
  )

  const columns = React.useMemo<GridColDef<CotizacionListado>[]>(
    () => [
      {
        field: 'numero',
        headerName: 'Número',
        width: 130,
        sortable: false,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatNumeroCotizacion(row.numero)}
            </Typography>
          </Box>
        ),
      },
      colFecha<CotizacionListado>('fecha', 'Fecha', { width: 120, sortable: false }),
      {
        field: 'cliente',
        headerName: 'Cliente',
        flex: 1.4,
        minWidth: 200,
        sortable: false,
        renderCell: ({ row }) => <ClienteCelda row={row} />,
      },
      colMonto<CotizacionListado>('total_usd', 'Total USD', { width: 140, sortable: false }),
      {
        field: 'fecha_vencimiento',
        headerName: 'Vence',
        width: 130,
        sortable: false,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <VenceTexto row={row} hoy={hoy} />
          </Box>
        ),
      },
      {
        field: 'estado_efectivo',
        headerName: 'Estado',
        width: 130,
        sortable: false,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <CotizacionEstadoChip estado={row.estado_efectivo} />
          </Box>
        ),
      },
      colAcciones<CotizacionListado>(accionesDe, {
        rowLabel: (row) => `cotización ${formatNumeroCotizacion(row.numero)}`,
        isPending: (row) => row.id === pendienteId,
      }),
    ],
    [accionesDe, hoy, pendienteId]
  )

  const conRango = Boolean(filtros.desde && filtros.hasta)
  const hayFiltros = Boolean(filtros.q) || filtros.estado !== 'abiertas' || conRango

  return (
    <AppDataGrid<CotizacionListado>
      tableId="cotizaciones"
      label="Cotizaciones"
      mode="server"
      rows={cotizaciones}
      rowCount={total}
      columns={columns}
      onQueryChange={onQueryChange}
      loading={cargando}
      searchable={false}
      getRowHref={(row) => `/cotizaciones/${row.id}`}
      filters={
        <Box sx={{ display: 'grid', gap: 1.5, width: '100%' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              type="search"
              placeholder="Buscar por número, cliente o teléfono"
              value={busqueda}
              onChange={(e) => onBuscar(e.target.value)}
              sx={{ flex: { xs: '1 1 100%', sm: '0 1 360px' } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: { 'aria-label': 'Buscar cotizaciones' },
              }}
            />
            {conRango ? (
              <Chip
                label="Quitar fechas"
                variant="outlined"
                onDelete={() => navegar({ desde: null, hasta: null, pagina: null })}
                onClick={() => navegar({ desde: null, hasta: null, pagina: null })}
              />
            ) : (
              <Chip
                icon={<DateRangeOutlinedIcon />}
                label="Filtrar por fecha"
                variant="outlined"
                onClick={() => navegar({ desde: inicioMes(hoy), hasta: hoy, pagina: null })}
              />
            )}
          </Box>
          {conRango ? (
            <RangoFechasSelector rango={{ desde: filtros.desde as string, hasta: filtros.hasta as string }} hoy={hoy} />
          ) : null}
          <Box role="group" aria-label="Filtrar por estado" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {FILTROS_ESTADO.map((f) => {
              const activo = f.value === filtros.estado
              return (
                <Chip
                  key={f.value}
                  label={f.label}
                  variant={activo ? 'soft' : 'outlined'}
                  color={activo ? 'primary' : 'default'}
                  aria-pressed={activo}
                  onClick={() => navegar({ estado: f.value === 'abiertas' ? null : f.value, pagina: null })}
                />
              )
            })}
          </Box>
        </Box>
      }
      emptyState={
        hayFiltros
          ? {
              title: 'Sin cotizaciones con estos filtros',
              description: 'Cambia la búsqueda o los filtros.',
              action: (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setBusqueda('')
                    navegar({ q: null, estado: null, desde: null, hasta: null, pagina: null })
                  }}
                >
                  Limpiar filtros
                </Button>
              ),
            }
          : {
              title: 'Aún no hay cotizaciones abiertas',
              description: 'Arma una cotización con productos y precios, y compártela con el cliente.',
              action: (
                <Button variant="contained" onClick={onNueva}>
                  Nueva cotización
                </Button>
              ),
            }
      }
      mobileCard={(row) => ({
        primary: row.cliente,
        secondary: `${formatNumeroCotizacion(row.numero)} · ${formatFecha(row.fecha)} · vence ${formatFecha(row.fecha_vencimiento)}`,
        status: <CotizacionEstadoChip estado={row.estado_efectivo} />,
        amount: formatUsd(row.total_usd),
        actions: (
          <RowActionsMenu
            label={`Acciones de la cotización ${formatNumeroCotizacion(row.numero)}`}
            actions={accionesDe(row)}
            pending={row.id === pendienteId}
          />
        ),
      })}
    />
  )
}
