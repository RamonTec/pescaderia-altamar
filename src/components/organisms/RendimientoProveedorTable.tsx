'use client'

import * as React from 'react'
import type { GridColDef } from '@mui/x-data-grid'
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined'
import { ChartCard } from '@/components/molecules/ChartCard'
import { AppDataGrid } from './AppDataGrid'
import { colKg, colMonto } from './appDataGridColumns'
import type { BloqueDashboard, RendimientoProveedor } from '@/types/domain'
import { formatEntero, formatKg, formatPct, formatUsd } from '@/lib/format'

type Fila = RendimientoProveedor & { id: string }

const colPct = (field: keyof RendimientoProveedor, headerName: string): GridColDef<Fila> => ({
  field,
  headerName,
  type: 'number',
  align: 'right',
  headerAlign: 'right',
  minWidth: 112,
  flex: 0.8,
  valueFormatter: (v: number | null) => (v === null || v === undefined ? '—' : formatPct(v)),
})

/**
 * Rendimiento por proveedor (15, B7): por proveedor del lote origen y
 * producto. Costo kg crudo medio y costo medio del kg obtenido =
 * Σ costo total / Σ kg de salida. Desde 16 un procesamiento tiene N salidas:
 * ese cociente es el costo medio de todas ellas, no el de un producto (la
 * RPC no cambia; solo la etiqueta). La merma encarece el kg neto (§4.3).
 */
export function RendimientoProveedorTable({ rendimiento }: { rendimiento: BloqueDashboard<RendimientoProveedor[]> }) {
  const filas: Fila[] = (rendimiento.ok ? rendimiento.data : []).map((r) => ({
    ...r,
    id: `${r.proveedor_id ?? 'sin'}-${r.producto_id}`,
    proveedor_nombre: r.proveedor_nombre ?? 'Sin proveedor',
  }))

  const columns: GridColDef<Fila>[] = [
    { field: 'proveedor_nombre', headerName: 'Proveedor', flex: 1.2, minWidth: 150 },
    { field: 'producto_nombre', headerName: 'Producto', flex: 1.2, minWidth: 150 },
    {
      field: 'procesos',
      headerName: 'Procesos',
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      minWidth: 96,
      valueFormatter: (v: number) => formatEntero(v),
    },
    { ...colKg<Fila>('kg_entrada', 'Entrada'), flex: 1 },
    { ...colKg<Fila>('kg_salida', 'Salida'), flex: 1 },
    colPct('rendimiento', 'Rendimiento'),
    colPct('merma_pct', 'Merma %'),
    { ...colMonto<Fila>('costo_kg_crudo_usd', 'Costo kg crudo'), flex: 1 },
    {
      ...colMonto<Fila>('costo_kg_limpio_usd', 'Costo medio kg obtenido'),
      flex: 1,
      minWidth: 150,
      // Con varias salidas por proceso (16) es el promedio de todas ellas,
      // no el costo de un producto en particular.
      description:
        'Costo total de lo que entró a proceso ÷ kg obtenidos de todas las salidas (filete, cabeza, piel…). Incluye la merma.',
    },
  ]

  return (
    <ChartCard
      title="Rendimiento por proveedor"
      help="Según el proveedor del lote que entró a proceso. El costo medio del kg obtenido reparte el costo de la entrada entre todos los kg que salieron (todas las salidas) e incluye la merma."
      error={rendimiento.ok ? null : rendimiento.error}
    >
      <AppDataGrid
        tableId="dashboard-rendimiento"
        label="Rendimiento por proveedor"
        rows={filas}
        columns={columns}
        mode="client"
        embedded
        pageParam="pagina_rendimiento"
        initialSort={[{ field: 'rendimiento', sort: 'desc' }]}
        searchPlaceholder="Buscar proveedor o producto"
        emptyState={{
          icon: <PrecisionManufacturingOutlinedIcon />,
          title: 'Sin procesamientos en el período',
          compact: true,
        }}
        mobileCard={(r) => ({
          primary: `${r.proveedor_nombre} · ${r.producto_nombre}`,
          secondary: `${formatKg(r.kg_entrada)} → ${formatKg(r.kg_salida)} · kg obtenido ${r.costo_kg_limpio_usd === null ? '—' : formatUsd(r.costo_kg_limpio_usd)}`,
          amount: r.rendimiento === null ? '—' : formatPct(r.rendimiento),
        })}
      />
    </ChartCard>
  )
}
