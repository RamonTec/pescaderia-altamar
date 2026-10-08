'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { ChartCard } from '@/components/molecules/ChartCard'
import { AppDataGrid } from './AppDataGrid'
import { colKg, colMonto } from './appDataGridColumns'
import type { BloqueDashboard, ProductoSalida } from '@/types/domain'
import { formatEntero, formatKg, formatPct, formatUsd } from '@/lib/format'

/** Margen % con color: rojo si negativo, ámbar si < 10 %. */
function MargenPct({ pct }: { pct: number | null }) {
  if (pct === null) return <>—</>
  const color = pct < 0 ? 'error.main' : pct < 0.1 ? 'warning.main' : 'success.main'
  return (
    <Box component="span" sx={{ color, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
      {formatPct(pct)}
    </Box>
  )
}

/**
 * Volumen y productos con salida (15, B2) y margen por producto (B3):
 * `AppDataGrid` en modo cliente. Kg, ventas USD sin IVA, facturas, precio
 * medio, costo, margen USD y % (netos de notas de crédito). El pie suma el
 * margen bruto del período.
 */
export function ProductosSalidaTable({ productos }: { productos: BloqueDashboard<ProductoSalida[]> }) {
  const filas = productos.ok ? productos.data : []
  const tot = filas.reduce(
    (a, p) => ({ kg: a.kg + p.kg, ventas: a.ventas + p.ventas_usd, margen: a.margen + p.margen_usd }),
    { kg: 0, ventas: 0, margen: 0 }
  )

  const columns: GridColDef<ProductoSalida>[] = [
    { field: 'producto_nombre', headerName: 'Producto', flex: 1.4, minWidth: 160 },
    { ...colKg<ProductoSalida>('kg', 'Kilos'), flex: 1 },
    { ...colMonto<ProductoSalida>('ventas_usd', 'Ventas'), flex: 1 },
    {
      field: 'facturas',
      headerName: 'Facturas',
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      minWidth: 96,
      valueFormatter: (v: number) => formatEntero(v),
    },
    { ...colMonto<ProductoSalida>('precio_medio_usd_kg', 'Precio medio/kg'), flex: 1 },
    { ...colMonto<ProductoSalida>('costo_usd', 'Costo'), flex: 1 },
    { ...colMonto<ProductoSalida>('margen_usd', 'Margen'), flex: 1 },
    {
      field: 'margen_pct',
      headerName: 'Margen %',
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      minWidth: 104,
      renderCell: ({ row }) => <MargenPct pct={row.margen_pct} />,
    },
  ]

  return (
    <ChartCard
      title="Productos con salida y margen"
      help="Kilos y ventas sin IVA del período, netos de notas de crédito; costo al snapshot de cada línea."
      error={productos.ok ? null : productos.error}
    >
      <AppDataGrid
        tableId="dashboard-productos"
        label="Productos con salida"
        rows={filas}
        columns={columns}
        getRowId={(r) => r.producto_id}
        mode="client"
        embedded
        pageParam="pagina_productos"
        initialSort={[{ field: 'ventas_usd', sort: 'desc' }]}
        searchPlaceholder="Buscar producto"
        emptyState={{
          icon: <Inventory2OutlinedIcon />,
          title: 'Sin ventas en el período',
          description: 'Cambia el rango de fechas para ver otros meses.',
          compact: true,
        }}
        mobileCard={(p) => ({
          primary: p.producto_nombre,
          secondary: `${formatKg(p.kg)} · ${formatEntero(p.facturas)} facturas · margen ${formatUsd(p.margen_usd)}`,
          status: <MargenPct pct={p.margen_pct} />,
          amount: formatUsd(p.ventas_usd),
        })}
      />
      {filas.length > 0 ? (
        <Typography
          variant="body2"
          sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          aria-live="polite"
        >
          Total {formatKg(tot.kg)} · Ventas {formatUsd(tot.ventas)} ·{' '}
          <Box component="strong" sx={{ fontWeight: 600 }}>
            Margen bruto {formatUsd(tot.margen)}
          </Box>
          {tot.ventas !== 0 ? ` (${formatPct(tot.margen / tot.ventas)})` : ''}
        </Typography>
      ) : null}
    </ChartCard>
  )
}
