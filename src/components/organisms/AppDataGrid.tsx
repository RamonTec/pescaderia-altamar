'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined'
import {
  DataGrid,
  type GridColDef,
  type GridColumnVisibilityModel,
  type GridPaginationModel,
  type GridRowIdGetter,
  type GridSortModel,
  type GridValidRowModel,
} from '@mui/x-data-grid'
import { EmptyState, type EmptyStateProps } from '@/components/molecules/EmptyState'
import { ErrorState } from '@/components/molecules/ErrorState'

/**
 * Toda tabla del sistema (spec § Tablas y paginación).
 *
 * - Textos en español (locale `esES` en el theme), 25 filas por defecto,
 *   opciones 25/50/100. El tamaño elegido se recuerda por `tableId` en
 *   `localStorage`; la página actual vive en la URL (`?pagina=2`).
 * - `mode="client"`: catálogos que crecen poco; búsqueda, orden y paginación
 *   en el navegador.
 * - `mode="server"`: registros que crecen con el tiempo; la tabla emite
 *   `onQueryChange` (búsqueda con debounce de 300 ms) y el padre trae la
 *   página con `.range()` + `count: 'exact'`, y pasa `rowCount`. La primera
 *   página la resuelve el servidor leyendo `?pagina` con `paginaDesdeParam()`.
 * - En `xs`, si hay `mobileCard`, muestra tarjetas en lista; si no, oculta
 *   las columnas de `hideOnMobile` en `xs`/`sm`.
 * - Estados: vacío (`emptyState`), sin resultados ("Limpiar búsqueda"),
 *   error (`ErrorState` dentro del área de la tabla), cargando (skeleton si no
 *   hay filas, barra si ya hay).
 */

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
const DEFAULT_PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300
const STORAGE_EVENT = 'app-data-grid-storage'

export interface AppDataGridQuery {
  /** Página 0-based. */
  page: number
  pageSize: number
  sort: GridSortModel
  search: string
}

export interface AppDataGridMobileCard {
  /** Línea principal (`subtitle1`). */
  primary: React.ReactNode
  /** Línea secundaria (`caption`): RIF, fecha… */
  secondary?: React.ReactNode
  /** Chip(s) de estado. */
  status?: React.ReactNode
  /** Monto alineado a la derecha. */
  amount?: React.ReactNode
  /** Menú `⋮` (`RowActionsMenu`). */
  actions?: React.ReactNode
}

export interface AppDataGridProps<R extends GridValidRowModel> {
  /** Identificador estable: clave del tamaño de página en `localStorage`. */
  tableId: string
  /** Nombre accesible de la tabla ("Clientes"). */
  label: string
  rows: readonly R[]
  columns: GridColDef<R>[]
  getRowId?: GridRowIdGetter<R>
  mode?: 'client' | 'server'
  /** Total de filas en el servidor (`mode="server"`). */
  rowCount?: number
  onQueryChange?: (query: AppDataGridQuery) => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Tabla sin registros ("Aún no hay compras" + "Registrar compra"). */
  emptyState: EmptyStateProps
  /** `false` oculta la búsqueda rápida. */
  searchable?: boolean
  searchPlaceholder?: string
  /** Filtros como chips, a la derecha de la búsqueda. */
  filters?: React.ReactNode
  /** Acciones de la tabla (exportar…), a la derecha de la barra. */
  actions?: React.ReactNode
  /** Tarjeta para `xs`. */
  mobileCard?: (row: R) => AppDataGridMobileCard
  /** Si la fila abre una ficha: toda la fila es clicable. */
  getRowHref?: (row: R) => string
  /** Columnas secundarias que se ocultan en `xs`/`sm` cuando no hay `mobileCard`. */
  hideOnMobile?: string[]
  initialSort?: GridSortModel
  /** Nombre del parámetro de página en la URL (si hay dos tablas en la misma pantalla). */
  pageParam?: string
}

/** Lee `?pagina=N` (1-based) y devuelve la página 0-based. Para `page.tsx` en modo servidor. */
export function paginaDesdeParam(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number(raw)
  return Number.isInteger(n) && n > 1 ? n - 1 : 0
}

declare module '@mui/x-data-grid' {
  interface NoRowsOverlayPropsOverrides {
    emptyState?: EmptyStateProps
    search?: string
    onClearSearch?: () => void
  }
  interface NoResultsOverlayPropsOverrides {
    search?: string
    onClearSearch?: () => void
  }
}

function NoResults({ search, onClearSearch }: { search?: string; onClearSearch?: () => void }) {
  return (
    <EmptyState
      icon={<SearchOffOutlinedIcon />}
      title={search ? `Sin resultados para «${search}»` : 'Sin resultados'}
      description="Revisa lo que escribiste o prueba con otra palabra."
      action={
        onClearSearch ? (
          <Button variant="outlined" onClick={onClearSearch}>
            Limpiar búsqueda
          </Button>
        ) : undefined
      }
    />
  )
}

function OverlayBox({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Box>
  )
}

function NoRowsOverlay({
  emptyState,
  search,
  onClearSearch,
}: {
  emptyState?: EmptyStateProps
  search?: string
  onClearSearch?: () => void
}) {
  return (
    <OverlayBox>
      {search ? (
        <NoResults search={search} onClearSearch={onClearSearch} />
      ) : emptyState ? (
        <EmptyState {...emptyState} />
      ) : null}
    </OverlayBox>
  )
}

function NoResultsOverlay({
  search,
  onClearSearch,
}: {
  search?: string
  onClearSearch?: () => void
}) {
  return (
    <OverlayBox>
      <NoResults search={search} onClearSearch={onClearSearch} />
    </OverlayBox>
  )
}

/* ---------- tamaño de página recordado (localStorage) ---------- */

function storageKey(tableId: string) {
  return `appDataGrid:${tableId}:pageSize`
}

function readPageSize(tableId: string): number {
  try {
    const v = Number(window.localStorage.getItem(storageKey(tableId)))
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(v) ? v : DEFAULT_PAGE_SIZE
  } catch {
    return DEFAULT_PAGE_SIZE
  }
}

function writePageSize(tableId: string, size: number) {
  try {
    window.localStorage.setItem(storageKey(tableId), String(size))
  } catch {
    // Almacenamiento bloqueado (modo privado): se usa el tamaño en memoria hasta recargar.
  }
  window.dispatchEvent(new Event(STORAGE_EVENT))
}

function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(STORAGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(STORAGE_EVENT, callback)
  }
}

function usePageSize(tableId: string): [number, (size: number) => void] {
  const [memory, setMemory] = React.useState<number | null>(null)
  const stored = React.useSyncExternalStore(
    subscribeStorage,
    () => readPageSize(tableId),
    () => DEFAULT_PAGE_SIZE
  )
  const set = React.useCallback(
    (size: number) => {
      setMemory(size)
      writePageSize(tableId, size)
    },
    [tableId]
  )
  return [memory ?? stored, set]
}

/* ---------- página en la URL ---------- */

function writePageParam(pageParam: string, page: number) {
  const params = new URLSearchParams(window.location.search)
  if (page <= 0) params.delete(pageParam)
  else params.set(pageParam, String(page + 1))
  const qs = params.toString()
  // History API nativa: Next sincroniza `useSearchParams` sin volver a pedir la página al servidor.
  window.history.replaceState(
    null,
    '',
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  )
}

/* ---------- búsqueda en cliente para las tarjetas ---------- */

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function matchesSearch<R extends GridValidRowModel>(
  row: R,
  columns: GridColDef<R>[],
  tokens: string[]
) {
  const text = normalize(
    columns
      .map((c) => {
        const v = (row as Record<string, unknown>)[c.field]
        return v === null || v === undefined ? '' : String(v)
      })
      .join(' ')
  )
  return tokens.every((t) => text.includes(t))
}

/* ---------- componente ---------- */

export function AppDataGrid<R extends GridValidRowModel>({
  tableId,
  label,
  rows,
  columns,
  getRowId,
  mode = 'client',
  rowCount,
  onQueryChange,
  loading = false,
  error = null,
  onRetry,
  emptyState,
  searchable = true,
  searchPlaceholder = 'Buscar',
  filters,
  actions,
  mobileCard,
  getRowHref,
  hideOnMobile,
  initialSort = [],
  pageParam = 'pagina',
}: AppDataGridProps<R>) {
  const theme = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))
  const server = mode === 'server'

  const page = paginaDesdeParam(searchParams.get(pageParam))
  const [pageSize, setPageSize] = usePageSize(tableId)
  const [sortModel, setSortModel] = React.useState<GridSortModel>(initialSort)
  const [search, setSearch] = React.useState('')
  // En modo cliente la búsqueda filtra al escribir; en servidor, con debounce.
  const [appliedSearch, setAppliedSearch] = React.useState('')
  const debounceRef = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(debounceRef.current), [])

  const emit = React.useCallback(
    (partial: Partial<AppDataGridQuery>) => {
      if (!server) return
      onQueryChange?.({ page, pageSize, sort: sortModel, search: appliedSearch, ...partial })
    },
    [server, onQueryChange, page, pageSize, sortModel, appliedSearch]
  )

  // Tamaño con el que el servidor resolvió la primera página (`page.tsx` no
  // conoce `localStorage`). Si el recordado es otro, se pide de nuevo la
  // página al hidratar; si no, el padre mostraría 25 filas con la paginación
  // calculada sobre 50/100 y se saltaría registros al avanzar.
  const emittedPageSize = React.useRef(DEFAULT_PAGE_SIZE)
  React.useEffect(() => {
    if (!server || pageSize === emittedPageSize.current) return
    emittedPageSize.current = pageSize
    emit({ pageSize })
  }, [server, pageSize, emit])

  const handlePagination = (model: GridPaginationModel) => {
    const sizeChanged = model.pageSize !== pageSize
    const nextPage = sizeChanged ? 0 : model.page
    if (sizeChanged) setPageSize(model.pageSize)
    if (nextPage !== page) writePageParam(pageParam, nextPage)
    emittedPageSize.current = model.pageSize
    emit({ page: nextPage, pageSize: model.pageSize })
  }

  const handleSort = (model: GridSortModel) => {
    setSortModel(model)
    if (server) {
      writePageParam(pageParam, 0)
      emit({ sort: model, page: 0 })
    }
  }

  const applySearch = (value: string) => {
    setAppliedSearch(value)
    writePageParam(pageParam, 0)
    emit({ search: value, page: 0 })
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    window.clearTimeout(debounceRef.current)
    if (server) {
      debounceRef.current = window.setTimeout(() => applySearch(value.trim()), SEARCH_DEBOUNCE_MS)
    } else {
      setAppliedSearch(value.trim())
      if (page !== 0) writePageParam(pageParam, 0)
    }
  }

  const clearSearch = () => {
    window.clearTimeout(debounceRef.current)
    setSearch('')
    applySearch('')
  }

  const columnVisibilityModel = React.useMemo<GridColumnVisibilityModel | undefined>(() => {
    if (!isMdDown || !hideOnMobile?.length) return undefined
    return Object.fromEntries(hideOnMobile.map((f) => [f, false]))
  }, [isMdDown, hideOnMobile])

  // Modelos controlados con referencia estable: un objeto nuevo en cada
  // render hace que DataGrid vuelva a aplicar el filtro/paginación cada vez.
  const paginationModel = React.useMemo(() => ({ page, pageSize }), [page, pageSize])
  const filterModel = React.useMemo(
    () => ({
      items: [],
      quickFilterValues: !server && appliedSearch ? appliedSearch.split(/\s+/) : [],
    }),
    [server, appliedSearch]
  )

  const useCards = isXs && !!mobileCard

  const toolbar =
    searchable || filters || actions ? (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.25,
          px: useCards ? 0 : 2,
          py: useCards ? 0 : 1.5,
        }}
      >
        {searchable ? (
          <TextField
            size="small"
            type="search"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={searchPlaceholder}
            slotProps={{
              htmlInput: { 'aria-label': `Buscar en ${label.toLowerCase()}` },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: { xs: '100%', sm: 320 } }}
          />
        ) : null}
        {filters ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{filters}</Box> : null}
        <Box sx={{ flexGrow: 1 }} />
        {actions}
      </Box>
    ) : null

  if (useCards && mobileCard) {
    return (
      <MobileCards
        label={label}
        rows={rows}
        columns={columns}
        getRowId={getRowId}
        server={server}
        rowCount={rowCount}
        page={page}
        pageSize={pageSize}
        search={appliedSearch}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyState={emptyState}
        mobileCard={mobileCard}
        getRowHref={getRowHref}
        toolbar={toolbar}
        onClearSearch={clearSearch}
        onPage={(p) => handlePagination({ page: p, pageSize })}
      />
    )
  }

  return (
    <Paper component="section" aria-label={label} sx={{ overflow: 'hidden' }}>
      {toolbar}
      {error ? (
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          <ErrorState message={error} onRetry={onRetry} />
        </Box>
      ) : (
        <DataGrid<R>
          aria-label={label}
          rows={rows}
          columns={columns}
          getRowId={getRowId}
          autoHeight
          rowHeight={52}
          columnHeaderHeight={44}
          disableColumnMenu
          disableRowSelectionOnClick
          loading={loading}
          pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePagination}
          paginationMode={server ? 'server' : 'client'}
          sortingMode={server ? 'server' : 'client'}
          filterMode={server ? 'server' : 'client'}
          rowCount={server ? (rowCount ?? 0) : undefined}
          sortModel={sortModel}
          onSortModelChange={handleSort}
          filterModel={filterModel}
          columnVisibilityModel={columnVisibilityModel}
          onRowClick={getRowHref ? ({ row }) => router.push(getRowHref(row as R)) : undefined}
          slots={{ noRowsOverlay: NoRowsOverlay, noResultsOverlay: NoResultsOverlay }}
          slotProps={{
            noRowsOverlay: { emptyState, search: appliedSearch, onClearSearch: clearSearch },
            noResultsOverlay: { search: appliedSearch, onClearSearch: clearSearch },
            loadingOverlay: {
              variant: rows.length > 0 ? 'linear-progress' : 'skeleton',
              noRowsVariant: 'skeleton',
            },
          }}
          sx={(t) => ({
            border: 0,
            borderRadius: 0,
            borderTop: toolbar ? 1 : 0,
            borderColor: 'divider',
            '--DataGrid-overlayHeight': '320px',
            '& .MuiDataGrid-row': {
              cursor: getRowHref ? 'pointer' : 'default',
              transition: t.transitions.create('background-color', {
                duration: t.transitions.duration.shortest,
              }),
            },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': {
              outlineOffset: -2,
            },
            // xs: sin selector de tamaño ("‹ 1–25 de 132 ›")
            [t.breakpoints.down('sm')]: {
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-input': { display: 'none' },
            },
          })}
        />
      )}
    </Paper>
  )
}

/* ---------- tarjetas en xs ---------- */

interface MobileCardsProps<R extends GridValidRowModel> {
  label: string
  rows: readonly R[]
  columns: GridColDef<R>[]
  getRowId?: GridRowIdGetter<R>
  server: boolean
  rowCount?: number
  page: number
  pageSize: number
  search: string
  loading: boolean
  error: string | null
  onRetry?: () => void
  emptyState: EmptyStateProps
  mobileCard: (row: R) => AppDataGridMobileCard
  getRowHref?: (row: R) => string
  toolbar: React.ReactNode
  onClearSearch: () => void
  onPage: (page: number) => void
}

function MobileCards<R extends GridValidRowModel>({
  label,
  rows,
  columns,
  getRowId,
  server,
  rowCount,
  page,
  pageSize,
  search,
  loading,
  error,
  onRetry,
  emptyState,
  mobileCard,
  getRowHref,
  toolbar,
  onClearSearch,
  onPage,
}: MobileCardsProps<R>) {
  const filtered = React.useMemo(() => {
    if (server || !search) return rows
    const tokens = normalize(search).split(/\s+/).filter(Boolean)
    return rows.filter((r) => matchesSearch(r, columns, tokens))
  }, [rows, columns, search, server])

  const total = server ? (rowCount ?? rows.length) : filtered.length
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)
  const current = Math.min(page, lastPage)
  const visible = server ? filtered : filtered.slice(current * pageSize, (current + 1) * pageSize)
  const from = total === 0 ? 0 : current * pageSize + 1
  const to = Math.min(total, (current + 1) * pageSize)

  const idOf = (row: R, i: number) =>
    getRowId ? getRowId(row) : ((row as { id?: React.Key }).id ?? i)

  let body: React.ReactNode
  if (error) {
    // Todo hijo directo del <ul> es un <li>.
    body = (
      <Paper component="li">
        <ErrorState message={error} onRetry={onRetry} />
      </Paper>
    )
  } else if (loading && visible.length === 0) {
    body = Array.from({ length: 4 }).map((_, i) => (
      <Skeleton
        key={i}
        component="li"
        variant="rounded"
        height={64}
        sx={{ opacity: 1 - i * 0.18 }}
      />
    ))
  } else if (visible.length === 0) {
    body = (
      <Paper component="li">
        {search ? (
          <NoResults search={search} onClearSearch={onClearSearch} />
        ) : (
          <EmptyState {...emptyState} />
        )}
      </Paper>
    )
  } else {
    body = visible.map((row, i) => {
      const card = mobileCard(row)
      const href = getRowHref?.(row)
      const main = (
        <Box sx={{ minWidth: 0, flexGrow: 1, display: 'grid', gap: 0.25 }}>
          <Typography variant="subtitle1" noWrap>
            {card.primary}
          </Typography>
          {card.secondary || card.status ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              {card.secondary ? (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {card.secondary}
                </Typography>
              ) : null}
              {card.status}
            </Box>
          ) : null}
        </Box>
      )
      return (
        <Paper
          key={idOf(row, i)}
          component="li"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minHeight: 64,
            pl: 2,
            pr: 0.5,
            py: 1,
          }}
        >
          {href ? (
            <Box
              component={Link}
              href={href}
              sx={{
                display: 'flex',
                minWidth: 0,
                flexGrow: 1,
                color: 'inherit',
                textDecoration: 'none',
                alignSelf: 'stretch',
                alignItems: 'center',
              }}
            >
              {main}
            </Box>
          ) : (
            main
          )}
          {card.amount ? (
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
            >
              {card.amount}
            </Typography>
          ) : null}
          {card.actions}
        </Paper>
      )
    })
  }

  return (
    <Box component="section" aria-label={label} sx={{ display: 'grid', gap: 1.5 }}>
      {toolbar}
      <Box sx={{ height: 3 }}>
        {loading && visible.length > 0 ? (
          <LinearProgress aria-label="Actualizando" sx={{ height: 3 }} />
        ) : null}
      </Box>
      <Box
        component="ul"
        aria-busy={loading}
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gap: 1,
          opacity: loading && visible.length > 0 ? 0.5 : 1,
        }}
      >
        {body}
      </Box>
      {total > 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <IconButton
            aria-label="Página anterior"
            disabled={current === 0}
            onClick={() => onPage(current - 1)}
          >
            <ChevronLeftOutlinedIcon />
          </IconButton>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {from}–{to} de {total}
          </Typography>
          <IconButton
            aria-label="Página siguiente"
            disabled={current >= lastPage}
            onClick={() => onPage(current + 1)}
          >
            <ChevronRightOutlinedIcon />
          </IconButton>
        </Box>
      ) : null}
    </Box>
  )
}
