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
import { RowActionsMenu } from '@/components/molecules/RowActionsMenu'
import { AppDataGrid, type AppDataGridQuery } from '@/components/organisms/AppDataGrid'
import {
  EstadoChip,
  colAcciones,
  colFecha,
  colMonto,
  type EstadoDef,
} from '@/components/organisms/appDataGridColumns'
import { useContratoAcciones } from '@/app/(protected)/contratos/useContratoAcciones'
import { ETIQUETA_TIPO_CONTRATO, fechaCorta, numeroContrato } from '@/lib/contratos/textos'
import { formatUsd } from '@/lib/format'
import type { FiltrosContratos } from '@/lib/contratoValidation'
import type { ContratoListado, EstadoContrato } from '@/types/domain'

const ESTADO_CONTRATO: Record<EstadoContrato, EstadoDef> = {
  generado: { label: 'Generado', color: 'default' },
  enviado: { label: 'Enviado', color: 'info' },
  firmado: { label: 'Firmado', color: 'success' },
  anulado: { label: 'Anulado', color: 'default' },
}

const FILTROS_TIPO: { value: FiltrosContratos['tipo'] | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'venta', label: 'Ventas' },
  { value: 'compra', label: 'Compras' },
]

const FILTROS_ESTADO: { value: FiltrosContratos['estado']; label: string }[] = [
  { value: 'activos', label: 'Activos' },
  { value: 'generado', label: 'Generados' },
  { value: 'enviado', label: 'Enviados' },
  { value: 'firmado', label: 'Firmados' },
  { value: 'anulado', label: 'Anulados' },
  { value: 'todos', label: 'Todos' },
]

const BUSQUEDA_DEBOUNCE_MS = 300

/** "Factura F-000123" o "Compra del 07/10/2026". */
function textoDocumento(c: ContratoListado): string {
  if (c.tipo === 'venta_credito') {
    return c.documento_numero === null ? 'Factura' : `Factura F-${String(c.documento_numero).padStart(6, '0')}`
  }
  return c.documento_fecha ? `Compra del ${fechaCorta(c.documento_fecha)}` : 'Compra'
}

function hrefContraparte(c: ContratoListado): string {
  if (!c.contraparte_id) return '/contratos'
  return c.tipo === 'venta_credito' ? `/clientes/${c.contraparte_id}` : `/proveedores/${c.contraparte_id}`
}

function EstadoContratoChips({ contrato }: { contrato: ContratoListado }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        alignItems: 'center',
        opacity: contrato.estado === 'anulado' ? 0.7 : 1,
      }}
    >
      <EstadoChip {...ESTADO_CONTRATO[contrato.estado]} />
      {contrato.origen_anulado && contrato.estado !== 'anulado' ? (
        <EstadoChip label="Documento anulado" color="warning" />
      ) : null}
    </Box>
  )
}

export interface ContratosTableProps {
  contratos: ContratoListado[]
  total: number
  filtros: FiltrosContratos
}

/**
 * Bitácora de contratos (06-contratos): `AppDataGrid` en modo servidor con
 * `?pagina=`, chips `?tipo=` / `?estado=` y búsqueda `?q=` (debounce 300 ms)
 * en la URL; el servidor trae la página. No genera contratos: se generan
 * desde el `⋮` de una factura o compra a crédito.
 */
export function ContratosTable({ contratos, total, filtros }: ContratosTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [cargando, startTransition] = React.useTransition()
  const [busqueda, setBusqueda] = React.useState(filtros.q ?? '')
  const debounceRef = React.useRef<number | undefined>(undefined)
  const { accionesDeContrato, estaPendiente, dialogos } = useContratoAcciones()

  React.useEffect(() => () => window.clearTimeout(debounceRef.current), [])

  /** Cambia parámetros de la URL y pide la página al servidor. */
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

  const columns = React.useMemo<GridColDef<ContratoListado>[]>(
    () => [
      {
        field: 'numero',
        headerName: 'N.º',
        width: 100,
        sortable: false,
        valueFormatter: (v: number) => numeroContrato(v),
      },
      colFecha<ContratoListado>('fecha', 'Fecha', { width: 120, sortable: false }),
      {
        field: 'tipo',
        headerName: 'Tipo',
        width: 100,
        sortable: false,
        valueFormatter: (v: ContratoListado['tipo']) => ETIQUETA_TIPO_CONTRATO[v],
      },
      {
        field: 'documento',
        headerName: 'Documento',
        flex: 1,
        minWidth: 170,
        sortable: false,
        valueGetter: (_v, row) => textoDocumento(row),
      },
      {
        field: 'contraparte_nombre',
        headerName: 'Contraparte',
        flex: 1.4,
        minWidth: 200,
        sortable: false,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'grid', alignContent: 'center', height: '100%', minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.contraparte_nombre ?? '—'}
            </Typography>
            {row.contraparte_rif_ci ? (
              <Typography variant="caption" color="text.secondary">
                {row.contraparte_rif_ci}
              </Typography>
            ) : null}
          </Box>
        ),
      },
      colMonto<ContratoListado>('monto_usd', 'Monto', { width: 130, sortable: false }),
      {
        field: 'estado',
        headerName: 'Estado',
        width: 220,
        sortable: false,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <EstadoContratoChips contrato={row} />
          </Box>
        ),
      },
      colAcciones<ContratoListado>((row) => accionesDeContrato(row), {
        rowLabel: (row) => `contrato ${numeroContrato(row.numero)}`,
        isPending: (row) => estaPendiente(row.id),
      }),
    ],
    [accionesDeContrato, estaPendiente]
  )

  const tipoActivo = filtros.tipo ?? null
  const hayFiltros = Boolean(filtros.q) || filtros.tipo !== undefined || filtros.estado !== 'activos'

  return (
    <>
      <AppDataGrid<ContratoListado>
        tableId="contratos"
        label="Contratos"
        mode="server"
        rows={contratos}
        rowCount={total}
        columns={columns}
        onQueryChange={onQueryChange}
        loading={cargando}
        searchable={false}
        getRowHref={hrefContraparte}
        filters={
          <Box sx={{ display: 'grid', gap: 1.5, width: '100%' }}>
            <TextField
              size="small"
              type="search"
              placeholder="Buscar por N.º, factura o contraparte"
              value={busqueda}
              onChange={(e) => onBuscar(e.target.value)}
              sx={{ maxWidth: { sm: 360 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: { 'aria-label': 'Buscar contratos' },
              }}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Box role="group" aria-label="Filtrar por tipo" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {FILTROS_TIPO.map((f) => {
                  const activo = f.value === tipoActivo
                  return (
                    <Chip
                      key={f.label}
                      label={f.label}
                      variant={activo ? 'soft' : 'outlined'}
                      color={activo ? 'primary' : 'default'}
                      aria-pressed={activo}
                      onClick={() => navegar({ tipo: f.value ?? null, pagina: null })}
                    />
                  )
                })}
              </Box>
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
                      onClick={() =>
                        navegar({ estado: f.value === 'activos' ? null : f.value, pagina: null })
                      }
                    />
                  )
                })}
              </Box>
            </Box>
          </Box>
        }
        emptyState={
          hayFiltros
            ? {
                title: 'Sin contratos con estos filtros',
                description: 'Cambia la búsqueda o los filtros.',
                action: (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setBusqueda('')
                      navegar({ q: null, tipo: null, estado: null, pagina: null })
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ),
              }
            : {
                title: 'Aún no hay contratos',
                description:
                  'Se generan desde el menú ⋮ de una factura o compra a crédito, en Cobros y pagos o en Compras.',
                action: (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                    <Button variant="outlined" href="/cobros">
                      Ir a Cobros y pagos
                    </Button>
                    <Button variant="outlined" href="/compras">
                      Ir a Compras
                    </Button>
                  </Box>
                ),
              }
        }
        mobileCard={(row) => ({
          primary: row.contraparte_nombre ?? '—',
          secondary: `${numeroContrato(row.numero)} · ${textoDocumento(row)} · ${fechaCorta(row.fecha)}`,
          status: <EstadoContratoChips contrato={row} />,
          amount: row.monto_usd === null ? undefined : formatUsd(row.monto_usd),
          actions: (
            <RowActionsMenu
              label={`Acciones del contrato ${numeroContrato(row.numero)}`}
              actions={accionesDeContrato(row)}
              pending={estaPendiente(row.id)}
            />
          ),
        })}
      />
      {dialogos}
    </>
  )
}
